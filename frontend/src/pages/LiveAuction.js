import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Clock, Play, Copy, Trophy, Zap, Sparkles, Info, StopCircle } from 'lucide-react';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const LiveAuction = () => {
  const { auctionId } = useParams();
  const navigate = useNavigate();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [latestBidId, setLatestBidId] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [bidHistory, setBidHistory] = useState([]);

  // Smart price formatting — no decimals if whole number
  const fmtPrice = (val) => {
    if (val == null) return '0';
    return Number.isInteger(val) ? val.toLocaleString('en-IN') : val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  useEffect(() => {
    fetchAuction();
    fetchBids();
    fetchBidHistory();

    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket');
      newSocket.emit('join_auction', {
        auction_id: auctionId,
        user_type: 'buyer',
      });
    });

    newSocket.on('bids_update', (data) => {
      console.log('Bids update received:', data);
      setBids(data.bids);
      if (data.bids.length > 0) {
        const latest = [...data.bids].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
        if (latest) {
          setLatestBidId(latest.id);
          setTimeout(() => setLatestBidId(null), 2000);
        }
      }
    });

    newSocket.on('auction_started', (data) => {
      console.log('Auction started:', data);
      fetchAuction();
    });

    newSocket.on('auction_extended', (data) => {
      console.log('Auction extended:', data);
      toast.info('Auction duration has been extended due to recent bidding activity!');
      fetchAuction();
    });

    newSocket.on('auction_terminated', () => {
      toast.error('Auction has been terminated.');
      fetchAuction();
    });

    // Poll for bids every 5 seconds as fallback (WebSocket may be unreliable on free tier)
    const pollInterval = setInterval(() => {
      fetchBids();
      fetchBidHistory();
      fetchAuction();
    }, 5000);

    return () => {
      newSocket.close();
      clearInterval(pollInterval);
    };
  }, [auctionId]);

  useEffect(() => {
    if (!auction || auction.status !== 'active' || !auction.end_time) return;

    const interval = setInterval(() => {
      const now = new Date();
      const end = new Date(auction.end_time);
      const diff = end - now;

      if (diff <= 0) {
        setTimeRemaining('Ended');
        clearInterval(interval);
        fetchAuction();
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [auction]);

  const fetchAuction = async () => {
    try {
      const response = await api.get(`/auctions/${auctionId}`);
      setAuction(response.data);
    } catch (error) {
      toast.error('Failed to load auction');
    } finally {
      setLoading(false);
    }
  };

  const fetchBids = async () => {
    try {
      const response = await api.get(`/auctions/${auctionId}/bids`);
      setBids(response.data);
    } catch (error) {
      console.error('Failed to load bids:', error);
    }
  };

  const fetchBidHistory = async () => {
    try {
      const response = await api.get(`/auctions/${auctionId}/bid-history`);
      setBidHistory(response.data);
    } catch (error) {
      console.error('Failed to load bid history:', error);
    }
  };

  const startAuction = async () => {
    try {
      await api.post(`/auctions/${auctionId}/start`);
      toast.success('Auction started!');
      fetchAuction();
    } catch (error) {
      toast.error('Failed to start auction');
    }
  };

  const terminateAuction = async () => {
    if (!window.confirm('Are you sure you want to TERMINATE this auction? This action cannot be undone. The current L1 bid will be the final result.')) {
      return;
    }
    try {
      await api.post(`/auctions/${auctionId}/terminate`);
      toast.success('Auction terminated successfully.');
      fetchAuction();
    } catch (error) {
      toast.error('Failed to terminate auction');
    }
  };

  const handleAIAnalyze = async () => {
    if (bids.length === 0) {
      toast.info('Need at least one bid for analysis');
      return;
    }
    setAiLoading(true);
    try {
      const response = await api.post('/ai/analyze', { auction_id: auctionId });
      setAiAnalysis(response.data.analysis);
      toast.success('AI Analysis generated!');
    } catch (error) {
      toast.error('Failed to generate AI analysis');
    } finally {
      setAiLoading(false);
    }
  };

  const copySupplierLink = (token) => {
    const link = `${window.location.origin}/supplier/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard!');
  };

  const getRankBadge = (rank) => {
    if (rank === 1) {
      return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 font-mono';
    } else if (rank === 2) {
      return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200 font-mono';
    } else {
      return 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200 font-mono';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading auction...</div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Auction not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/')} data-testid="back-to-dashboard">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Zap className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-heading font-bold text-slate-900">{auction.title}</h1>
              <p className="text-sm text-slate-600">Ref: {auction.reference_number}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6" data-testid="status-card">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Status
            </div>
            <div className="text-2xl font-heading font-bold text-slate-900">
              {auction.status === 'draft' && 'Draft'}
              {auction.status === 'active' && 'Live Auction'}
              {auction.status === 'completed' && 'Completed'}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6" data-testid="timer-card">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Time Remaining
            </div>
            <div className="text-3xl font-mono font-bold text-slate-900">
              {auction.status === 'active' ? timeRemaining || 'Calculating...' : auction.status === 'draft' ? 'Not Started' : 'Ended'}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6" data-testid="bids-count-card">
            <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Total Bids
            </div>
            <div className="text-2xl font-heading font-bold text-slate-900">{bids.length}</div>
          </div>

          <div className="bg-white rounded-xl border border-indigo-100 shadow-sm p-6 bg-gradient-to-br from-white to-indigo-50/30" data-testid="savings-card">
            <div className="text-sm font-semibold text-indigo-600 uppercase tracking-wide mb-2">
              Total Savings
            </div>
            {(() => {
              const totalQty = (auction.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0) || 1;
              const totalEstimated = (auction.config?.start_price || 0) * totalQty;
              const bestBidTotal = bids.length > 0 ? Math.min(...bids.map(b => b.total_amount)) : totalEstimated;
              const savings = Math.max(0, totalEstimated - bestBidTotal);
              const savingsPercent = totalEstimated > 0 ? ((savings / totalEstimated) * 100).toFixed(1) : '0.0';
              return (
                <>
                  <div className="text-2xl font-heading font-bold text-indigo-700">
                    ₹{savings.toLocaleString('en-IN')}
                  </div>
                  <div className="text-xs text-indigo-400 mt-1">
                    {bids.length > 0 ? `${savingsPercent}% below estimated ₹${totalEstimated.toLocaleString('en-IN')}` : 'No bids yet'}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {auction.status === 'draft' && (
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-xl p-8 mb-8 text-white" data-testid="start-auction-section">
            <h3 className="text-2xl font-heading font-bold mb-2">Ready to start?</h3>
            <p className="mb-4 opacity-90">
              Once started, the auction will run for {auction.config?.duration_minutes || 0} minutes.
            </p>
            <Button
              onClick={startAuction}
              size="lg"
              className="bg-white text-primary hover:bg-slate-100 h-12 px-8"
              data-testid="start-auction-button"
            >
              <Play className="w-5 h-5 mr-2" />
              Start Auction
            </Button>
          </div>
        )}

        {/* Terminate button for active auctions */}
        {auction.status === 'active' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8" data-testid="terminate-section">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-heading font-bold text-red-900 mb-1">Terminate Auction</h3>
                <p className="text-red-700 text-sm">End the auction immediately. Current L1 bid will be the final result.</p>
              </div>
              <Button
                onClick={terminateAuction}
                variant="destructive"
                className="h-12 px-8 bg-red-600 hover:bg-red-700"
                data-testid="terminate-button"
              >
                <StopCircle className="w-5 h-5 mr-2" />
                Terminate Auction
              </Button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-500" />
              <h3 className="text-xl font-heading font-bold text-slate-900 text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">
                AI Market Intelligence
              </h3>
            </div>
            <Button
              onClick={handleAIAnalyze}
              disabled={aiLoading}
              variant="outline"
              className="border-indigo-100 hover:bg-indigo-50 text-indigo-600"
            >
              {aiLoading ? 'Analyzing...' : 'Refresh Insights'}
            </Button>
          </div>

          {aiAnalysis ? (
            <div className="bg-slate-50 rounded-lg p-6 border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500" />
              <p className="text-slate-700 leading-relaxed italic">
                "{aiAnalysis}"
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <Info className="w-3 h-3" />
                Generated by BidFlow AI using Groq
              </div>
            </div>
          ) : (
            <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-lg">
              <p className="text-slate-500 text-sm">
                Get real-time insights on bid patterns and supplier behavior.
              </p>
              <Button
                variant="link"
                onClick={handleAIAnalyze}
                disabled={aiLoading}
                className="text-indigo-600 font-semibold"
              >
                Run First Analysis
              </Button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 mb-8" data-testid="supplier-links-section">
          <h3 className="text-xl font-heading font-bold text-slate-900 mb-4">Supplier Links</h3>
          <div className="space-y-3">
            {(auction.suppliers || []).map((supplier, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg"
                data-testid={`supplier-link-${idx}`}
              >
                <div>
                  <div className="font-semibold text-slate-900">{supplier.name}</div>
                  <div className="text-sm text-slate-600">{supplier.email}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copySupplierLink(supplier.token)}
                  data-testid={`copy-link-${idx}`}
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Link
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8" data-testid="bids-table">
          <h3 className="text-xl font-heading font-bold text-slate-900 mb-2">Live Bidding</h3>
          <p className="text-sm text-slate-500 mb-4">Every bid action is recorded with timestamp, unit price, and decremental value.</p>
          {bidHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-500" data-testid="no-bids">
              No bids received yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-200 bg-slate-50">
                    <th className="text-center py-3 px-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">#</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">Time</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">Supplier</th>
                    <th className="text-right py-3 px-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">Unit Price</th>
                    <th className="text-right py-3 px-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">Total Amount</th>
                    <th className="text-right py-3 px-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">Decrement</th>
                    <th className="text-right py-3 px-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">L1 After</th>
                    <th className="text-left py-3 px-3 font-semibold text-slate-700 uppercase tracking-wide text-xs">L1 Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {bidHistory.map((entry, idx) => {
                    const isNewL1 = entry.decrement > 0;
                    const ts = new Date(entry.timestamp);
                    const timeStr = ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const dateStr = ts.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                    return (
                      <tr
                        key={idx}
                        className={`border-b border-slate-100 transition-colors ${isNewL1 ? 'bg-emerald-50 hover:bg-emerald-100' : 'hover:bg-slate-50'
                          } ${idx === bidHistory.length - 1 ? 'animate-pulse' : ''}`}
                      >
                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs">
                            {entry.round}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          <div className="font-mono text-xs">{timeStr}</div>
                          <div className="text-xs text-slate-400">{dateStr}</div>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900">{entry.supplier_name}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          ₹{fmtPrice(entry.unit_price_avg)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          ₹{fmtPrice(entry.total_amount)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {entry.decrement > 0 ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              ▼ ₹{fmtPrice(entry.decrement)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          ₹{fmtPrice(entry.l1_unit_price)}
                        </td>
                        <td className="py-3 px-3 text-slate-700">
                          {entry.l1_supplier}
                          {isNewL1 && <Trophy className="w-3 h-3 inline ml-1 text-emerald-600" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LiveAuction;