import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Zap, TrendingDown, Trophy, AlertCircle, Ban, CheckCircle2 } from 'lucide-react';
import { io } from 'socket.io-client';


const PAYMENT_OPTIONS = [
  'Advance', '30 Days Credit', '45 Days Credit', '60 Days Credit',
  '30 Days PDC', '100% against PI', '30%-60%-10%', '50%-50%',
  '90%-10%', '10%-90%', '40%-60%', '100% against Delivery',
];

const SupplierBidding = () => {
  const { token } = useParams();
  const [auction, setAuction] = useState(null);
  const [currentBid, setCurrentBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [concluded, setConcluded] = useState(false);
  const [socket, setSocket] = useState(null);
  const [rank, setRank] = useState(0);
  const [rankColor, setRankColor] = useState('red');

  const [itemBids, setItemBids] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [deliveryDays, setDeliveryDays] = useState(0);
  const [warrantyMonths, setWarrantyMonths] = useState(12);
  const [paymentTerms, setPaymentTerms] = useState('');
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
      fetchAuction(); // Refresh L1 data
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

    newSocket.on('auction_terminated', () => {
      toast.error('The buyer has terminated this auction.');
      fetchAuction();
    });

    // Polling fallback for L1 updates
    const pollInterval = setInterval(() => {
      fetchAuction();
    }, 5000);

    return () => {
      newSocket.close();
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Calculate overall L1
      const l1Bid = allBids.length > 0 ? Math.min(...allBids.map(b => b.total_amount)) : null;

      // Calculate item-wise L1s — find the lowest unit price for each item index across all suppliers
      const itemL1s = (auctionData.items || []).map((item, idx) => {
        const prices = allBids.map(b => b.item_bids[idx]?.unit_price).filter(p => p > 0);
        return prices.length > 0 ? Math.min(...prices) : null;
      });

      setAuction({ ...auctionData, current_l1: l1Bid, item_l1s: itemL1s, bids_count: allBids.length });

      setItemBids((prev) => {
        if (!prev || prev.length === 0) {
          return response.data.items.map((item) => ({
            item_code: item.item_code,
            unit_price: 0,
          }));
        }
        return prev;
      });
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
        setWarrantyMonths(response.data.warranty_months || 12);
        setRemarks(response.data.remarks || '');
        setRank(response.data.rank || 0);
        if (response.data.remarks && response.data.remarks.includes('[CONCLUDED]')) {
          setConcluded(true);
        }
      }
    } catch (error) {
      console.log('No existing bid');
    }
  };

  // Smart price formatting — no decimals if whole number
  const fmtPrice = (val) => {
    if (val == null) return '0';
    return Number.isInteger(val) ? val.toLocaleString('en-IN') : val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Determine if we should force whole numbers
  const isWholeDecrement = auction && Number.isInteger(auction.config?.min_decrement);

  const updateItemBid = (index, value) => {
    const updated = [...itemBids];
    // Force integer when decrement is a whole number — zero tolerance
    if (isWholeDecrement) {
      updated[index].unit_price = parseInt(value, 10) || 0;
    } else {
      updated[index].unit_price = Math.round(parseFloat(value) * 100) / 100 || 0;
    }
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
    // Force integer total when using whole number decrement
    setTotalAmount(isWholeDecrement ? Math.round(total) : Math.round(total * 100) / 100);
  };

  // Frontend pre-validation before API call
  const validateBidLocally = () => {
    for (let i = 0; i < itemBids.length; i++) {
      const item = (auction.items || [])[i];
      if (!item) continue;

      const unitPrice = itemBids[i]?.unit_price || 0;
      const itemCeiling = item.start_price || auction.config?.start_price || 0;
      const itemMinDecr = item.min_decrement || auction.config?.min_decrement || 0;

      if (unitPrice <= 0) {
        return `Please enter a valid unit price for ${item.item_code || `Item ${i + 1}`}`;
      }

      if (itemCeiling > 0 && unitPrice >= itemCeiling) {
        return `${item.item_code}: Unit price (₹${unitPrice}) must be lower than ceiling (₹${itemCeiling}/unit)`;
      }

      // Check multiples using integer math (cents)
      if (itemMinDecr > 0 && itemCeiling > 0) {
        const startCents = Math.round(itemCeiling * 100);
        const priceCents = Math.round(unitPrice * 100);
        const decrementCents = Math.round(itemMinDecr * 100);
        const diffCents = startCents - priceCents;
        if (diffCents <= 0 || diffCents % decrementCents !== 0) {
          const v1 = itemCeiling - itemMinDecr;
          return `${item.item_code}: Unit price must be a multiple of ₹${itemMinDecr} below ceiling (₹${itemCeiling}). Valid: ₹${fmtPrice(v1)}, ₹${fmtPrice(v1 - itemMinDecr)}...`;
        }
      }

      // Check vs L1 for this specific item if possible?
      // Actually current schema stores a single total L1. 
      // The L1 check is usually on the total amount.
    }

    if (auction.current_l1) {
      const totalMinDecr = (auction.items || []).reduce((sum, item) => sum + (item.min_decrement || auction.config?.min_decrement || 0) * (item.quantity || 0), 0) || 1;
      if (totalAmount > (auction.current_l1 - totalMinDecr)) {
        return `Total bid (₹${totalAmount.toLocaleString('en-IN')}) must be at least ₹${totalMinDecr.toLocaleString('en-IN')} lower than current L1 total (₹${auction.current_l1.toLocaleString('en-IN')})`;
      }
    }

    return null; // Valid
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (concluded) {
      toast.error('You have concluded your bidding. No further bids allowed.');
      return;
    }

    if (totalAmount === 0) {
      toast.error('Please enter valid bid amounts');
      return;
    }

    // Local validation first — instant feedback
    const validationError = validateBidLocally();
    if (validationError) {
      toast.error(validationError, { duration: 6000 });
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
        remarks: `${remarks || ''}${paymentTerms ? ` | Payment: ${paymentTerms}` : ''}`,
      };

      await api.post(`/bids`, payload);
      toast.success('Bid submitted successfully!');
      fetchCurrentBid();
      fetchAuction();
    } catch (error) {
      // Show prominent error popup
      const errorMsg = error.response?.data?.detail || 'Failed to submit bid';
      toast.error(errorMsg, { duration: 8000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConclude = async () => {
    if (!window.confirm('Are you sure you want to conclude? Your last bid will be your final offer. You cannot bid again.')) {
      return;
    }
    try {
      await api.post(`/supplier/${token}/conclude`);
      setConcluded(true);
      toast.success('You have concluded your bidding. Your last bid stands as your final offer.');
    } catch (error) {
      toast.error('Failed to conclude bidding');
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

  const totalQty = (auction.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0) || 1;
  const currentL1Unit = auction.current_l1 ? (auction.current_l1 / totalQty) : null;
  const startPrice = auction.config?.start_price || 0;
  const minDecrement = auction.config?.min_decrement || 0;

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
        {/* Auction Info Bar — always visible */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-slate-500 font-semibold uppercase text-xs">Payment</div>
              <div className="font-medium text-slate-900">{auction.payment_terms || '-'}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase text-xs">Freight</div>
              <div className="font-medium text-slate-900">{auction.freight_condition || '-'}</div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase text-xs">Total Ceiling</div>
              <div className="font-mono font-bold text-slate-900">
                ₹{(auction.items || []).reduce((sum, it) => sum + (it.start_price || auction.config?.start_price || 0) * (it.quantity || 0), 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div>
              <div className="text-slate-500 font-semibold uppercase text-xs">Total Min Decr</div>
              <div className="font-mono font-bold text-slate-900">
                ₹{(auction.items || []).reduce((sum, it) => sum + (it.min_decrement || auction.config?.min_decrement || 0) * (it.quantity || 0), 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Concluded Banner */}
        {concluded && (
          <div className="bg-slate-100 border border-slate-300 rounded-xl p-6 mb-8">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-slate-600 mt-1" />
              <div>
                <h3 className="text-lg font-heading font-bold text-slate-800 mb-1">Bidding Concluded</h3>
                <p className="text-slate-600">You have concluded your bidding. Your last bid stands as your final offer.</p>
              </div>
            </div>
          </div>
        )}

        {auction.status === 'completed' && (
          <div className={`border rounded-xl p-6 mb-8 ${rank === 1 ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-100 border-slate-300'}`}>
            <div className="flex items-start gap-3">
              {rank === 1 ? <Trophy className="w-8 h-8 text-emerald-600 mt-1 animate-bounce" /> : <Ban className="w-6 h-6 text-slate-600 mt-1" />}
              <div>
                <h3 className={`text-xl font-heading font-bold mb-1 ${rank === 1 ? 'text-emerald-800' : 'text-slate-800'}`}>
                  {rank === 1 ? 'Congratulations! You Won the Auction!' : 'Auction Ended'}
                </h3>
                <p className={`text-lg ${rank === 1 ? 'text-emerald-700 font-medium' : 'text-slate-600'}`}>
                  {rank === 1
                    ? 'Your bid was ranked L1! A formal Purchase Order (PO) shall be sent to you soon.'
                    : 'This auction has been completed. No further bids are accepted.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {auction.status === 'draft' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-8" data-testid="draft-banner">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-amber-600 mt-1" />
              <div>
                <h3 className="text-lg font-heading font-bold text-amber-900 mb-1">
                  Auction Not Started Yet
                </h3>
                <p className="text-amber-800">
                  The live bidding will begin once the buyer starts the auction.
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
                  Submit lower bids to improve your ranking. The lowest bid (L1) wins.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* L1 Price Panel — always visible when auction is active or has bids */}
        {(auction.status === 'active' || auction.bids_count > 0) && (
          <div className="bg-slate-900 text-white rounded-xl p-6 mb-8 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Trophy className="w-24 h-24" />
            </div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">
                  Current L1 Price (per unit)
                </div>
                <div className="text-4xl font-mono font-bold text-emerald-400">
                  ₹{(auction.current_l1 || (auction.items || []).reduce((sum, it) => sum + (it.start_price || 0) * (it.quantity || 0), 0)).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {auction.current_l1
                    ? `Total Amount | ${auction.bids_count} bid(s) placed`
                    : `No bids yet. Total Ceiling: ₹${(auction.items || []).reduce((sum, it) => sum + (it.start_price || 0) * (it.quantity || 0), 0).toLocaleString('en-IN')}`}
                </div>
              </div>
              <div className="h-full border-l border-slate-700 hidden md:block" />
              <div>
                <div className="text-slate-400 text-sm font-semibold uppercase tracking-wider mb-1">
                  Your Target Total Price
                </div>
                <div className="text-2xl font-mono font-bold text-white">
                  {(() => {
                    const totalCeiling = (auction.items || []).reduce((sum, it) => sum + (it.start_price || 0) * (it.quantity || 0), 0);
                    const totalMinDecr = (auction.items || []).reduce((sum, it) => sum + (it.min_decrement || 0) * (it.quantity || 0), 0);
                    const currentL1 = auction.current_l1 || totalCeiling;
                    return `≤ ₹${(currentL1 - totalMinDecr).toLocaleString('en-IN')}`;
                  })()}
                </div>
                <div className="mt-2 text-xs text-slate-400 italic">
                  Overall min decrement is the sum of item decrements.
                </div>
              </div>
            </div>
          </div>
        )}

        {!concluded && auction.status !== 'completed' && (
          <form onSubmit={handleSubmit} data-testid="bid-form">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 mb-8">
              <h3 className="text-xl font-heading font-bold text-slate-900 mb-6">Submit Your Bid</h3>

              <div className="space-y-6">
                <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-sm">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase tracking-wide text-xs">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Item Code</th>
                        <th className="px-4 py-3 font-semibold w-1/3">Description</th>
                        <th className="px-4 py-3 font-semibold text-center w-20">Qty</th>
                        <th className="px-4 py-3 font-semibold text-center w-20">Unit</th>
                        <th className="px-4 py-3 font-semibold text-right w-24" title="Ceiling Price">Ceiling</th>
                        <th className="px-4 py-3 font-semibold text-right w-24" title="Min Decrement">Decr</th>
                        <th className="px-4 py-3 font-semibold text-right w-24 text-emerald-600">L1 Unit</th>
                        <th className="px-4 py-3 font-semibold text-right w-32">Your Price</th>
                        <th className="px-4 py-3 font-semibold text-right w-36">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auction.items.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors" data-testid={`item-bid-${idx}`}>
                          <td className="px-4 py-3 font-bold text-slate-900">{item.item_code}</td>
                          <td className="px-4 py-3 text-slate-600">{item.description}</td>
                          <td className="px-2 py-3 text-center text-slate-700">{item.quantity || 0}</td>
                          <td className="px-2 py-3 text-center text-slate-700 text-xs">{item.unit || 'PCS'}</td>
                          <td className="px-2 py-3 text-right font-mono text-slate-500">₹{(item.start_price || 0).toLocaleString('en-IN')}</td>
                          <td className="px-2 py-3 text-right font-mono text-slate-500">₹{(item.min_decrement || 0).toLocaleString('en-IN')}</td>
                          <td className="px-2 py-3 text-right font-mono font-bold text-emerald-600 bg-emerald-50/50">
                            {auction.item_l1s?.[idx] ? `₹${auction.item_l1s[idx].toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              step={(item.min_decrement || 1) % 1 === 0 ? '1' : '0.01'}
                              value={itemBids[idx]?.unit_price || ''}
                              onChange={(e) => updateItemBid(idx, e.target.value)}
                              placeholder="0"
                              className="h-10 text-right font-mono text-base border-slate-300 focus-visible:ring-indigo-500 bg-emerald-50/30"
                              required
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50">
                            ₹{((itemBids[idx]?.unit_price || 0) * (item.quantity || 0)).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 rounded-lg p-6">
                  <div className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-2">
                    Total Bid Amount
                  </div>
                  <div className="text-4xl font-mono font-bold text-slate-900" data-testid="total-amount">
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      Warranty *
                    </Label>
                    <select
                      id="warranty_months"
                      value={warrantyMonths}
                      onChange={(e) => setWarrantyMonths(parseInt(e.target.value) || 0)}
                      className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      data-testid="warranty-input"
                    >
                      <option value={12}>12 Months</option>
                      <option value={24}>24 Months</option>
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="payment_terms" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                      Payment Terms *
                    </Label>
                    <select
                      id="payment_terms"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Select Payment Terms</option>
                      {PAYMENT_OPTIONS.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
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

            <div className="sticky bottom-4 z-50 flex items-center justify-center gap-4 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-700 mt-8 mx-auto max-w-2xl">
              <Button
                type="submit"
                disabled={submitting || concluded}
                size="lg"
                className="h-14 px-12 text-lg font-bold shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white transition-all transform hover:scale-105"
                data-testid="submit-bid-button"
              >
                {submitting ? 'Submitting...' : currentBid ? 'Update Bid' : 'Submit Bid'}
              </Button>

              {currentBid && !concluded && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleConclude}
                  className="h-14 px-8 text-lg font-bold border-rose-500 text-rose-500 hover:bg-rose-500 hover:text-white transition-all"
                >
                  <Ban className="w-5 h-5 mr-2" />
                  Conclude Bidding
                </Button>
              )}
            </div>
          </form>
        )}
      </main>
    </div>
  );
};

export default SupplierBidding;