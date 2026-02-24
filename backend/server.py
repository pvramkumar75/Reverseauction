from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import socketio
from jose import JWTError, jwt
from passlib.context import CryptContext
import secrets
from groq import Groq
from sqlalchemy import create_engine, Column, String, Float, Integer, DateTime, Text, ForeignKey, select, update, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, relationship

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# SQLite Database setup
DATABASE_URL = os.environ.get('DATABASE_URL', "sqlite+aiosqlite:///./bidflow.db")
engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET', secrets.token_urlsafe(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Groq client
groq_client = None
if os.environ.get('GROQ_API_KEY'):
    groq_client = Groq(api_key=os.environ['GROQ_API_KEY'])

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=True,
    engineio_logger=True
)

# Models (SQLAlchemy)
class UserDB(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    name = Column(String)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class AuctionDB(Base):
    __tablename__ = "auctions"
    id = Column(String, primary_key=True)
    buyer_id = Column(String)
    title = Column(String)
    reference_number = Column(String)
    description = Column(Text)
    payment_terms = Column(String)
    delivery_terms = Column(String)
    freight_condition = Column(String)
    items = Column(Text)  # JSON string
    suppliers = Column(Text)  # JSON string
    config = Column(Text)  # JSON string
    status = Column(String, default="draft")
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class BidDB(Base):
    __tablename__ = "bids"
    id = Column(String, primary_key=True)
    auction_id = Column(String, index=True)
    supplier_token = Column(String, index=True)
    supplier_name = Column(String)
    item_bids = Column(Text)  # JSON string
    total_amount = Column(Float)
    delivery_days = Column(Integer)
    warranty_months = Column(Integer, nullable=True)
    remarks = Column(Text, nullable=True)
    rank = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# Pydantic Models (matching existing ones)
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str

class ItemSpec(BaseModel):
    item_code: str
    description: str
    quantity: float
    unit: str
    estimated_price: Optional[float] = None

class SupplierInfo(BaseModel):
    name: str
    contact_person: str
    email: EmailStr
    phone: str
    token: str = Field(default_factory=lambda: secrets.token_urlsafe(32))

class AuctionConfig(BaseModel):
    start_price: float
    min_decrement: float
    duration_minutes: int
    buffer_minutes: int = 2

class AuctionCreate(BaseModel):
    title: str
    reference_number: str
    description: str
    payment_terms: str
    delivery_terms: str
    freight_condition: str
    items: List[ItemSpec]
    suppliers: List[SupplierInfo]
    config: AuctionConfig

class Auction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    buyer_id: str
    title: str
    reference_number: str
    description: str
    payment_terms: str
    delivery_terms: str
    freight_condition: str
    items: List[ItemSpec]
    suppliers: List[SupplierInfo]
    config: AuctionConfig
    status: str = "draft"
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    created_at: datetime

class BidCreate(BaseModel):
    auction_id: str
    supplier_token: str
    item_bids: List[Dict[str, Any]]
    total_amount: float
    delivery_days: int
    warranty_months: Optional[int] = None
    remarks: Optional[str] = None

class Bid(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    auction_id: str
    supplier_token: str
    supplier_name: str
    item_bids: List[Dict[str, Any]]
    total_amount: float
    delivery_days: int
    warranty_months: Optional[int] = None
    remarks: Optional[str] = None
    rank: int = 0
    created_at: datetime
    updated_at: datetime

# Create the main app
app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")

# Helper functions
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        
        result = await db.execute(select(UserDB).where(UserDB.id == user_id))
        user = result.scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return User(id=user.id, email=user.email, name=user.name)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")

# Auth endpoints
@api_router.post("/auth/register", response_model=Token)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = UserDB(
        id=str(uuid.uuid4()),
        email=user_data.email,
        password_hash=pwd_context.hash(user_data.password),
        name=user_data.name
    )
    db.add(user)
    await db.commit()
    
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(UserDB).where(UserDB.email == credentials.email))
    user = result.scalar_one_or_none()
    if not user or not pwd_context.verify(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    access_token = create_access_token(data={"sub": user.id})
    return {"access_token": access_token, "token_type": "bearer"}

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Auction endpoints
@api_router.post("/auctions", response_model=Auction)
async def create_auction(auction_data: AuctionCreate, db: AsyncSession = Depends(get_db)):
    auction_id = str(uuid.uuid4())
    auction = AuctionDB(
        id=auction_id,
        buyer_id="public",
        title=auction_data.title,
        reference_number=auction_data.reference_number,
        description=auction_data.description,
        payment_terms=auction_data.payment_terms,
        delivery_terms=auction_data.delivery_terms,
        freight_condition=auction_data.freight_condition,
        items=json.dumps([i.model_dump() for i in auction_data.items]),
        suppliers=json.dumps([s.model_dump() for s in auction_data.suppliers]),
        config=json.dumps(auction_data.config.model_dump()),
        status="draft"
    )
    db.add(auction)
    await db.commit()
    await db.refresh(auction)
    
    # Return pydantic model
    return Auction(
        id=auction.id,
        buyer_id=auction.buyer_id,
        title=auction.title,
        reference_number=auction.reference_number,
        description=auction.description,
        payment_terms=auction.payment_terms,
        delivery_terms=auction.delivery_terms,
        freight_condition=auction.freight_condition,
        items=auction_data.items,
        suppliers=auction_data.suppliers,
        config=auction_data.config,
        status=auction.status,
        created_at=auction.created_at
    )

@api_router.get("/auctions/all", response_model=List[Dict[str, Any]])
async def get_all_auctions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuctionDB).order_by(AuctionDB.created_at.desc()))
    auctions = result.scalars().all()
    enhanced_auctions = []
    for a in auctions:
        auction_dict = {
            "id": a.id,
            "buyer_id": a.buyer_id,
            "title": a.title,
            "reference_number": a.reference_number,
            "description": a.description,
            "payment_terms": a.payment_terms,
            "delivery_terms": a.delivery_terms,
            "freight_condition": a.freight_condition,
            "items": json.loads(a.items),
            "suppliers": json.loads(a.suppliers),
            "config": json.loads(a.config),
            "status": a.status,
            "start_time": a.start_time,
            "end_time": a.end_time,
            "created_at": a.created_at
        }
        
        # Get best bid
        bid_result = await db.execute(
            select(BidDB).where(BidDB.auction_id == a.id).order_by(BidDB.total_amount.asc())
        )
        best_bid = bid_result.scalars().first()
        auction_dict['current_l1'] = best_bid.total_amount if best_bid else None
        enhanced_auctions.append(auction_dict)
        
    return enhanced_auctions

@api_router.get("/auctions/{auction_id}")
async def get_auction_by_id(auction_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == auction_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Check if auction should be completed
    status = a.status
    if status == 'active' and a.end_time:
        if datetime.now(timezone.utc).replace(tzinfo=None) > a.end_time:
            status = 'completed'
            await db.execute(update(AuctionDB).where(AuctionDB.id == auction_id).values(status=status))
            await db.commit()
    
    return {
        "id": a.id,
        "buyer_id": a.buyer_id,
        "title": a.title,
        "reference_number": a.reference_number,
        "description": a.description,
        "payment_terms": a.payment_terms,
        "delivery_terms": a.delivery_terms,
        "freight_condition": a.freight_condition,
        "items": json.loads(a.items),
        "suppliers": json.loads(a.suppliers),
        "config": json.loads(a.config),
        "status": status,
        "start_time": a.start_time,
        "end_time": a.end_time,
        "created_at": a.created_at
    }

@api_router.post("/auctions/{auction_id}/start")
async def start_auction(auction_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == auction_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    config = json.loads(a.config)
    start_time = datetime.now(timezone.utc).replace(tzinfo=None)
    end_time = start_time + timedelta(minutes=config['duration_minutes'])
    
    await db.execute(
        update(AuctionDB).where(AuctionDB.id == auction_id).values(
            status="active",
            start_time=start_time,
            end_time=end_time
        )
    )
    await db.commit()
    
    # Notify all connected clients
    await sio.emit('auction_started', {'auction_id': auction_id, 'end_time': end_time.isoformat()}, room=f"buyer_{auction_id}")
    # Also notify all suppliers in that auction
    suppliers = json.loads(a.suppliers)
    for s in suppliers:
        await sio.emit('auction_started', {'auction_id': auction_id, 'end_time': end_time.isoformat()}, room=f"supplier_{s['token']}")
    
    return {"message": "Auction started", "end_time": end_time}

# Supplier endpoints
@api_router.get("/supplier/{token}")
async def get_supplier_auction(token: str, db: AsyncSession = Depends(get_db)):
    # Find auction where suppliers list contains this token
    # Since we store as JSON string, we'll search by string matching - but for better reliability, we'll fetch and filter
    # For large datasets this is slow, but SQLite can handle it for this app
    result = await db.execute(select(AuctionDB))
    all_auctions = result.scalars().all()
    
    auction = None
    supplier = None
    for a in all_auctions:
        suppliers = json.loads(a.suppliers)
        supplier = next((s for s in suppliers if s['token'] == token), None)
        if supplier:
            auction = a
            break
            
    if not auction:
        raise HTTPException(status_code=404, detail="Invalid supplier link")
    
    return {
        "id": auction.id,
        "title": auction.title,
        "reference_number": auction.reference_number,
        "description": auction.description,
        "payment_terms": auction.payment_terms,
        "delivery_terms": auction.delivery_terms,
        "freight_condition": auction.freight_condition,
        "items": json.loads(auction.items),
        "config": json.loads(auction.config),
        "status": auction.status,
        "supplier_info": supplier,
        "start_time": auction.start_time,
        "end_time": auction.end_time
    }

@api_router.post("/bids", response_model=Bid)
async def create_or_update_bid(bid_data: BidCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == bid_data.auction_id))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    suppliers = json.loads(auction.suppliers)
    supplier = next((s for s in suppliers if s['token'] == bid_data.supplier_token), None)
    if not supplier:
        raise HTTPException(status_code=403, detail="Invalid supplier token")
    
    if auction.status != 'active':
        raise HTTPException(status_code=400, detail="Auction is not active")
    
    config = json.loads(auction.config)
    if bid_data.total_amount >= config['start_price']:
        raise HTTPException(
            status_code=400, 
            detail=f"Bid must be lower than starting price (₹{config['start_price']})"
        )
    
    # Get current best bid
    bid_result = await db.execute(
        select(BidDB).where(BidDB.auction_id == bid_data.auction_id).order_by(BidDB.total_amount.asc())
    )
    best_bid = bid_result.scalars().first()
    
    if best_bid:
        min_decrement = config['min_decrement']
        max_allowed = best_bid.total_amount - min_decrement
        if bid_data.total_amount > max_allowed:
            raise HTTPException(
                status_code=400,
                detail=f"Bid must be at least ₹{min_decrement} lower than the current best bid (Max allowed: ₹{max_allowed})"
            )
    
    # Check if bid exists
    result = await db.execute(
        select(BidDB).where(BidDB.auction_id == bid_data.auction_id, BidDB.supplier_token == bid_data.supplier_token)
    )
    existing_bid = result.scalar_one_or_none()
    
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if existing_bid:
        bid_id = existing_bid.id
        await db.execute(
            update(BidDB).where(BidDB.id == bid_id).values(
                item_bids=json.dumps(bid_data.item_bids),
                total_amount=bid_data.total_amount,
                delivery_days=bid_data.delivery_days,
                warranty_months=bid_data.warranty_months,
                remarks=bid_data.remarks,
                updated_at=now
            )
        )
    else:
        bid_id = str(uuid.uuid4())
        new_bid = BidDB(
            id=bid_id,
            auction_id=bid_data.auction_id,
            supplier_token=bid_data.supplier_token,
            supplier_name=supplier['name'],
            item_bids=json.dumps(bid_data.item_bids),
            total_amount=bid_data.total_amount,
            delivery_days=bid_data.delivery_days,
            warranty_months=bid_data.warranty_months,
            remarks=bid_data.remarks,
            created_at=now,
            updated_at=now
        )
        db.add(new_bid)
    
    await db.commit()
    
    # Calculate ranks and emit
    await calculate_and_emit_ranks(bid_data.auction_id, db)
    
    # Auto-Extension
    buffer_mins = config.get('buffer_minutes', 2)
    end_time = auction.end_time
    time_left = end_time - now
    
    if time_left < timedelta(minutes=buffer_mins):
        new_end_time = end_time + timedelta(minutes=buffer_mins)
        await db.execute(update(AuctionDB).where(AuctionDB.id == auction.id).values(end_time=new_end_time))
        await db.commit()
        
        ext_payload = {'auction_id': auction.id, 'new_end_time': new_end_time.isoformat()}
        await sio.emit('auction_extended', ext_payload, room=f"buyer_{auction.id}")
        for s in suppliers:
            await sio.emit('auction_extended', ext_payload, room=f"supplier_{s['token']}")

    # Get updated bid for response
    result = await db.execute(select(BidDB).where(BidDB.id == bid_id))
    b = result.scalar_one()
    return Bid(
        id=b.id,
        auction_id=b.auction_id,
        supplier_token=b.supplier_token,
        supplier_name=b.supplier_name,
        item_bids=json.loads(b.item_bids),
        total_amount=b.total_amount,
        delivery_days=b.delivery_days,
        warranty_months=b.warranty_months,
        remarks=b.remarks,
        rank=b.rank,
        created_at=b.created_at,
        updated_at=b.updated_at
    )

@api_router.get("/auctions/{auction_id}/bids")
async def get_auction_bids(auction_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BidDB).where(BidDB.auction_id == auction_id))
    bids = result.scalars().all()
    return [{
        "id": b.id,
        "auction_id": b.auction_id,
        "supplier_token": b.supplier_token,
        "supplier_name": b.supplier_name,
        "item_bids": json.loads(b.item_bids),
        "total_amount": b.total_amount,
        "delivery_days": b.delivery_days,
        "warranty_months": b.warranty_months,
        "remarks": b.remarks,
        "rank": b.rank,
        "updated_at": b.updated_at
    } for b in bids]

@api_router.get("/supplier/{token}/bid")
async def get_supplier_bid(token: str, auction_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BidDB).where(BidDB.auction_id == auction_id, BidDB.supplier_token == token)
    )
    b = result.scalar_one_or_none()
    if not b: return None
    return {
        "id": b.id,
        "auction_id": b.auction_id,
        "supplier_token": b.supplier_token,
        "supplier_name": b.supplier_name,
        "item_bids": json.loads(b.item_bids),
        "total_amount": b.total_amount,
        "delivery_days": b.delivery_days,
        "warranty_months": b.warranty_months,
        "remarks": b.remarks,
        "rank": b.rank,
        "updated_at": b.updated_at
    }

async def calculate_and_emit_ranks(auction_id: str, db: AsyncSession):
    result = await db.execute(select(BidDB).where(BidDB.auction_id == auction_id))
    bids = result.scalars().all()
    
    # Sort by amount, then time
    sorted_bids = sorted(bids, key=lambda x: (x.total_amount, x.updated_at))
    
    for idx, bid in enumerate(sorted_bids):
        rank = idx + 1
        await db.execute(update(BidDB).where(BidDB.id == bid.id).values(rank=rank))
        
        # Emit to supplier
        rank_color = "green" if rank == 1 else "orange" if rank == 2 else "red"
        await sio.emit('rank_update', {
            'rank': rank,
            'color': rank_color,
            'total_amount': bid.total_amount
        }, room=f"supplier_{bid.supplier_token}")
        
    await db.commit()
    
    buyer_bids = [{
        'id': b.id,
        'supplier_name': b.supplier_name,
        'total_amount': b.total_amount,
        'delivery_days': b.delivery_days,
        'rank': b.rank,
        'updated_at': b.updated_at.isoformat()
    } for b in sorted_bids]
    
    await sio.emit('bids_update', {'bids': buyer_bids}, room=f"buyer_{auction_id}")

# AI Endpoints
@api_router.post("/ai/analyze")
async def analyze_auction(data: Dict[str, Any], db: AsyncSession = Depends(get_db)):
    if not groq_client:
        return {"analysis": "AI Intelligence unavailable."}
    
    auction_id = data.get('auction_id')
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == auction_id))
    a = result.scalar_one_or_none()
    if not a: raise HTTPException(status_code=404, detail="Auction not found")
    
    bid_result = await db.execute(select(BidDB).where(BidDB.auction_id == auction_id))
    bids = bid_result.scalars().all()
    config = json.loads(a.config)
    
    prompt = f"Analyze reverse auction: {a.title}. Start Price: {config['start_price']}. Bids: {[{'s': b.supplier_name, 'a': b.total_amount} for b in bids]}"
    
    try:
        completion = groq_client.chat.completions.create(
            model="mixtral-8x7b-32768",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=300
        )
        return {"analysis": completion.choices[0].message.content}
    except:
        return {"analysis": "AI Analysis failed."}

# Socket.IO
@sio.event
async def join_auction(sid, data):
    room = f"buyer_{data.get('auction_id')}" if data.get('user_type') == 'buyer' else f"supplier_{data.get('token')}"
    sio.enter_room(sid, room)

# App Setup
app.include_router(api_router)
socket_app = socketio.ASGIApp(sio, app)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host="0.0.0.0", port=8000)