import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Zap, TrendingDown, Trophy, AlertCircle } from 'lucide-react';
import { io } from 'socket.io-client';


const SupplierBidding = () => {
  const { token } = useParams();
  const [auction, setAuction] = useState(null);
  const [currentBid, setCurrentBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [socket, setSocket] = useState(null);
  const [rank, setRank] = useState(0);
  const [rankColor, setRankColor] = useState('red');

  const [itemBids, setItemBids] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [deliveryDays, setDeliveryDays] = useState(0);
  const [warrantyMonths, setWarrantyMonths] = useState(0);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    fetchAuction();
    fetchCurrentBid();

    const newSocket = io(process.env.REACT_APP_BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Supplier connected to WebSocket');
    });

    newSocket.on('rank_update', (data) => {
      console.log('Rank update received:', data);
      setRank(data.rank);
      setRankColor(data.color);
    });

    newSocket.on('auction_started', (data) => {
      console.log('Auction started:', data);
      fetchAuction();
    });

    newSocket.on('auction_extended', (data) => {
      console.log('Auction extended:', data);
      toast.info('Auction duration has been extended!');
      fetchAuction();
    });

    return () => {
      newSocket.close();
    };
  }, [token]);

  useEffect(() => {
    if (socket && auction?.id) {
      socket.emit('join_auction', {
        auction_id: auction.id,
        user_type: 'supplier',
        token: token,
      });
    }
  }, [socket, auction, token]);

  const fetchAuction = async () => {
    try {
      const response = await api.get(`/supplier/${token}`);
      const auctionData = response.data;

      // Fetch latest bids to find L1 for the supplier visibility
      const bidsResponse = await api.get(`/auctions/${auctionData.id}/bids`);
      const allBids = bidsResponse.data;
      const l1Bid = allBids.length > 0 ? Math.min(...allBids.map(b => b.total_amount)) : null;

      setAuction({ ...auctionData, current_l1: l1Bid });

      const initialBids = response.data.items.map((item) => ({
        item_code: item.item_code,
        unit_price: 0,
      }));
      setItemBids(initialBids);
    } catch (error) {
      toast.error('Failed to load auction');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentBid = async () => {
    try {
      const response = await api.get(
        `/supplier/${token}/bid?auction_id=${auction?.id || ''}`
      );
      if (response.data) {
        setCurrentBid(response.data);
        setItemBids(response.data.item_bids);
        setTotalAmount(response.data.total_amount);
        setDeliveryDays(response.data.delivery_days);
        setWarrantyMonths(response.data.warranty_months || 0);
        setRemarks(response.data.remarks || '');
        setRank(response.data.rank || 0);
      }
    } catch (error) {
      console.log('No existing bid');
    }
  };

  const updateItemBid = (index, value) => {
    const updated = [...itemBids];
    updated[index].unit_price = parseFloat(value) || 0;
    setItemBids(updated);
    calculateTotal(updated);
  };

  const calculateTotal = (bids) => {
    let total = 0;
    (bids || []).forEach((bid, idx) => {
      const item = (auction.items || [])[idx];
      if (item) {
        total += (bid.unit_price || 0) * (item.quantity || 0);
      }
    });
    setTotalAmount(total);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (totalAmount === 0) {
      toast.error('Please enter valid bid amounts');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        auction_id: auction.id,
        supplier_token: token,
        item_bids: itemBids,
        total_amount: totalAmount,
        delivery_days: deliveryDays,
        warranty_months: warrantyMonths || null,
        remarks: remarks || null,
      };

      await api.post(`/bids`, payload);
      toast.success('Bid submitted successfully!');
      fetchCurrentBid();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit bid');
    } finally {
      setSubmitting(false);
    }
  };

  const getRankBadgeStyle = () => {
    if (rankColor === 'green') {
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    } else if (rankColor === 'orange') {
      return 'bg-amber-100 text-amber-700 border-amber-200';
    } else {
      return 'bg-rose-100 text-rose-700 border-rose-200';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-heading font-bold text-slate-900 mb-2">Invalid Link</h2>
          <p className="text-slate-600">This supplier link is not valid.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-primary" />
              <div>
                <h1 className="text-3xl font-heading font-bold text-slate-900">{auction.title}</h1>
                <p className="text-sm text-slate-600">{auction.supplier_info?.name || 'Supplier'}</p>
              </div>
            </div>
            {rank > 0 && (
              <div data-testid="rank-indicator">
                <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-1 text-right">
                  Your Rank
                </div>
                <div
                  className={`inline-flex items-center px-4 py-2 rounded-full text-lg font-bold border ${getRankBadgeStyle()} font-mono`}
                >
                  {rank === 1 && <Trophy className="w-5 h-5 mr-2" />}
                  L{rank}
                  {rank === 1 ? ' - WINNING!' : rank === 2 ? ' - CLOSE!' : ''}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {auction.status === 'draft' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8" data-testid="draft-banner">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-1" />
              <div>
                <h3 className="text-lg font-heading font-bold text-amber-900 mb-1">
                  Auction Not Started Yet
                </h3>
                <p className="text-amber-800">
                  You can submit your initial quote now. The live bidding will begin once the buyer
                  starts the auction.
                </p>
              </div>
            </div>
          </div>
        )}

        {auction.status === 'active' && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 mb-8" data-testid="active-banner">
            <div className="flex items-start gap-3">
              <TrendingDown className="w-6 h-6 text-emerald-600 mt-1" />
              <div>
                <h3 className="text-lg font-heading font-bold text-emerald-900 mb-1">
                  Live Auction in Progress!
                </h3>
                <p className="text-emerald-800">
                  Submit lower bids to improve your ranking. The lowest bid (L1) wins the auction.
                </p>
              </div>
            </div>
          </div>
        )}

        {auction.status === 'active' && (
          <div className="bg-slate-900 text-white rounded-xl p-6 mb-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Trophy className="w-24 h-24" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Current Leading Bid (L1)</div>
                <div className="text-4xl font-mono font-bold text-emerald-400">
                  ₹{(auction.current_l1 || auction.config?.start_price || 0).toLocaleString('en-IN')}
                </div>
              </div>
              <div className="h-full border-l border-slate-700 hidden md:block" />
              <div>
                <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">Target to Lead</div>
                <div className="text-2xl font-mono font-bold text-white">
                  ₹{Math.max(0, (auction.current_l1 || auction.config?.start_price || 0) - (auction.config?.min_decrement || 0)).toLocaleString('en-IN')}
                </div>
                <div className="mt-2 text-xs text-slate-400 italic">
                  Drop below this to take the Lead position.
                </div>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} data-testid="bid-form">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 mb-8">
            <h3 className="text-xl font-heading font-bold text-slate-900 mb-6">Submit Your Bid</h3>

            <div className="space-y-6">
              {auction.items.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4" data-testid={`item-bid-${idx}`}>
                  <div className="mb-3">
                    <div className="font-bold text-slate-900">{item.item_code}</div>
                    <div className="text-sm text-slate-600">
                      {item.description} - Qty: {item.quantity || 0} {item.unit || 'PCS'}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                      Your Unit Price (₹)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={itemBids[idx]?.unit_price || ''}
                      onChange={(e) => updateItemBid(idx, e.target.value)}
                      placeholder="0.00"
                      className="h-12 font-mono text-lg"
                      required
                    />
                    <p className="text-sm text-slate-500 mt-1">
                      Line Total: <span className="font-mono font-bold">₹{((itemBids[idx]?.unit_price || 0) * item.quantity).toLocaleString('en-IN')}</span>
                    </p>
                  </div>
                </div>
              ))}

              <div className="bg-slate-50 rounded-lg p-6">
                <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                  Total Bid Amount
                </div>
                <div className="text-4xl font-mono font-bold text-slate-900" data-testid="total-amount">
                  ₹{totalAmount.toLocaleString('en-IN')}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="delivery_days" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                    Delivery Days *
                  </Label>
                  <Input
                    id="delivery_days"
                    type="number"
                    value={deliveryDays}
                    onChange={(e) => setDeliveryDays(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="h-12"
                    required
                    data-testid="delivery-days-input"
                  />
                </div>

                <div>
                  <Label htmlFor="warranty_months" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                    Warranty (Months)
                  </Label>
                  <Input
                    id="warranty_months"
                    type="number"
                    value={warrantyMonths}
                    onChange={(e) => setWarrantyMonths(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="h-12"
                    data-testid="warranty-input"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="remarks" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Remarks
                </Label>
                <Textarea
                  id="remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Any additional notes or conditions"
                  rows={3}
                  data-testid="remarks-input"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={submitting}
              size="lg"
              className="h-14 px-12 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
              data-testid="submit-bid-button"
            >
              {submitting ? 'Submitting...' : currentBid ? 'Update Bid' : 'Submit Bid'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default SupplierBidding;