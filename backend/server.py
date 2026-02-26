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

# Database setup (SQLite or Postgres)
DATABASE_URL = os.environ.get('DATABASE_URL', "sqlite+aiosqlite:///./bidflow.db")
connect_args = {}

if DATABASE_URL.startswith("postgresql://"):
    # Clear query params like ?sslmode=require because asyncpg handles SSL differently
    if "?" in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.split("?")[0]
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    connect_args = {"ssl": True}

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=300,
    connect_args=connect_args
)
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
    created_at = Column(DateTime, default=lambda: datetime.utcnow())

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
    bid_history = Column(Text, default="[]")  # JSON array of bid events
    created_at = Column(DateTime, default=lambda: datetime.utcnow())

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
    created_at = Column(DateTime, default=lambda: datetime.utcnow())
    updated_at = Column(DateTime, default=lambda: datetime.utcnow())

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
fastapi_app = FastAPI()

# CORS configuration
fastapi_app.add_middleware(
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
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
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
        if datetime.utcnow() > a.end_time:
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
    start_time = datetime.utcnow()
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

@api_router.post("/auctions/{auction_id}/terminate")
async def terminate_auction(auction_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == auction_id))
    a = result.scalar_one_or_none()
    if not a:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    await db.execute(
        update(AuctionDB).where(AuctionDB.id == auction_id).values(status="completed")
    )
    await db.commit()
    
    # Notify all
    await sio.emit('auction_terminated', {'auction_id': auction_id}, room=f"buyer_{auction_id}")
    suppliers = json.loads(a.suppliers)
    for s in suppliers:
        await sio.emit('auction_terminated', {'auction_id': auction_id}, room=f"supplier_{s['token']}")
    
    return {"message": "Auction terminated successfully"}

@api_router.post("/supplier/{token}/conclude")
async def conclude_supplier_bid(token: str, db: AsyncSession = Depends(get_db)):
    """Supplier concludes bidding — they won't bid further."""
    result = await db.execute(select(AuctionDB))
    all_auctions = result.scalars().all()
    auction = None
    for a in all_auctions:
        suppliers = json.loads(a.suppliers)
        if any(s['token'] == token for s in suppliers):
            auction = a
            break
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    
    # Mark the supplier's bid as concluded
    result = await db.execute(
        select(BidDB).where(BidDB.auction_id == auction.id, BidDB.supplier_token == token)
    )
    bid = result.scalar_one_or_none()
    if bid:
        await db.execute(
            update(BidDB).where(BidDB.id == bid.id).values(remarks=(bid.remarks or '') + ' [CONCLUDED]')
        )
        await db.commit()
    
    return {"message": "You have concluded your bidding. Your last bid stands as final."}

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
    min_decrement = config['min_decrement']
    start_price = config['start_price']
    
    # Validate each item's UNIT PRICE
    for item_bid in bid_data.item_bids:
        unit_price = item_bid.get('unit_price', 0)
        # Must be below ceiling
        if unit_price >= start_price:
            raise HTTPException(
                status_code=400, 
                detail=f"Unit price (₹{unit_price}) must be lower than ceiling price (₹{start_price}/unit)"
            )
        # Must be a valid multiple of min_decrement below start_price
        if min_decrement > 0:
            # If decrement is a whole number, force bid to be a whole number
            # Using epsilon to check if it has any fractional part
            is_whole_decrement = abs(min_decrement - round(min_decrement)) < 0.0001
            if is_whole_decrement:
                has_fraction = abs(unit_price - round(unit_price)) > 0.0001
                if has_fraction:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Unit price (₹{unit_price}) must be a whole number because the minimum decrement (₹{min_decrement}) is a whole number."
                    )

            # Use integer math (cents) to avoid floating point issues for all cases
            start_cents = int(round(start_price * 100))
            price_cents = int(round(unit_price * 100))
            decrement_cents = int(round(min_decrement * 100))
            
            diff_cents = start_cents - price_cents
            if diff_cents <= 0 or diff_cents % decrement_cents != 0:
                v1 = round(start_price - min_decrement, 2)
                v2 = round(start_price - 2 * min_decrement, 2)
                v3 = round(start_price - 3 * min_decrement, 2)
                raise HTTPException(
                    status_code=400,
                    detail=f"Unit price (₹{unit_price}) must be a multiple of ₹{min_decrement} below ceiling (₹{start_price}). Valid examples: ₹{v1}, ₹{v2}, ₹{v3}..."
                )
    
    # Get current best bid (L1)
    bid_result = await db.execute(
        select(BidDB).where(BidDB.auction_id == bid_data.auction_id).order_by(BidDB.total_amount.asc())
    )
    best_bid = bid_result.scalars().first()
    
    if best_bid:
        best_item_bids = json.loads(best_bid.item_bids) if isinstance(best_bid.item_bids, str) else best_bid.item_bids
        for i, item_bid in enumerate(bid_data.item_bids):
            unit_price = item_bid.get('unit_price', 0)
            if i < len(best_item_bids):
                best_unit = best_item_bids[i].get('unit_price', 0)
                max_allowed_unit = best_unit - min_decrement
                if unit_price > max_allowed_unit:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Unit price (₹{unit_price}) must be at least ₹{min_decrement} lower than current L1 (₹{best_unit}/unit). Max allowed: ₹{max_allowed_unit}/unit"
                    )

    
    # Check if bid exists
    result = await db.execute(
        select(BidDB).where(BidDB.auction_id == bid_data.auction_id, BidDB.supplier_token == bid_data.supplier_token)
    )
    existing_bid = result.scalar_one_or_none()
    
    now = datetime.utcnow()
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
    
    # --- Record bid history entry ---
    # Reload auction to get current bid_history
    await db.refresh(auction)
    history = json.loads(auction.bid_history or '[]')
    
    # Calculate decrement from previous L1
    prev_l1_unit = start_price  # default to ceiling
    if len(history) > 0:
        prev_l1_unit = history[-1].get('l1_unit_price', start_price)
    
    items_info = json.loads(auction.items)
    total_qty = sum(it.get('quantity', 0) for it in items_info) or 1
    
    # Use the first item's unit price if only one item, or calc avg
    if len(bid_data.item_bids) == 1:
        new_unit_price = bid_data.item_bids[0].get('unit_price', 0)
    else:
        new_unit_price = bid_data.total_amount / total_qty
    
    # Calculate decrement using integer cents for precision
    p_l1_cents = int(round(prev_l1_unit * 100))
    n_up_cents = int(round(new_unit_price * 100))
    decrement_cents = p_l1_cents - n_up_cents
    decrement_value = max(0, decrement_cents / 100.0)
    
    # Get updated L1 after this bid
    l1_result = await db.execute(
        select(BidDB).where(BidDB.auction_id == bid_data.auction_id).order_by(BidDB.total_amount.asc())
    )
    current_l1_bid = l1_result.scalars().first()
    
    # Determine display L1 unit price
    if current_l1_bid:
        c_l1_items = json.loads(current_l1_bid.item_bids) if isinstance(current_l1_bid.item_bids, str) else current_l1_bid.item_bids
        if len(c_l1_items) == 1:
            current_l1_unit = c_l1_items[0].get('unit_price', 0)
        else:
            current_l1_unit = current_l1_bid.total_amount / total_qty
    else:
        current_l1_unit = start_price

    # Build per-item unit prices
    item_prices = []
    for ib in bid_data.item_bids:
        item_prices.append({
            'item_code': ib.get('item_code', ''),
            'unit_price': ib.get('unit_price', 0)
        })
    
    # If decrement is a whole number, force displays to be whole numbers
    is_whole_decrement = abs(min_decrement - round(min_decrement)) < 0.0001
    
    history_entry = {
        'timestamp': now.isoformat(),
        'supplier_name': supplier['name'],
        'supplier_token': bid_data.supplier_token,
        'item_prices': item_prices,
        'total_amount': bid_data.total_amount,
        'unit_price_avg': round(new_unit_price) if is_whole_decrement else round(new_unit_price, 2),
        'decrement': round(decrement_value) if is_whole_decrement else round(decrement_value, 2),
        'l1_unit_price': round(current_l1_unit) if is_whole_decrement else round(current_l1_unit, 2),
        'l1_supplier': current_l1_bid.supplier_name if current_l1_bid else supplier['name'],
        'delivery_days': bid_data.delivery_days,
        'warranty_months': bid_data.warranty_months,
        'bid_type': 'update' if existing_bid else 'new',
        'round': len(history) + 1
    }
    history.append(history_entry)
    
    await db.execute(
        update(AuctionDB).where(AuctionDB.id == auction.id).values(bid_history=json.dumps(history))
    )
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

@api_router.get("/auctions/{auction_id}/bid-history")
async def get_bid_history(auction_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AuctionDB).where(AuctionDB.id == auction_id))
    auction = result.scalar_one_or_none()
    if not auction:
        raise HTTPException(status_code=404, detail="Auction not found")
    return json.loads(auction.bid_history or '[]')

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
fastapi_app.include_router(api_router)
app = socketio.ASGIApp(sio, fastapi_app)

@fastapi_app.on_event("startup")
async def startup():
    from sqlalchemy import text as sa_text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrate: add bid_history column if missing (for existing databases)
        try:
            await conn.execute(sa_text(
                "ALTER TABLE auctions ADD COLUMN IF NOT EXISTS bid_history TEXT DEFAULT '[]'"
            ))
            logging.info("Migration: bid_history column ensured on auctions table")
        except Exception as e:
            logging.warning(f"Migration note (safe to ignore): {e}")

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)