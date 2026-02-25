import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Clock, Play, Copy, Trophy, Zap, Sparkles, Info } from 'lucide-react';
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

  useEffect(() => {
    fetchAuction();
    fetchBids();

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

    // Poll for bids every 5 seconds as fallback (WebSocket may be unreliable on free tier)
    const pollInterval = setInterval(() => {
      fetchBids();
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

  const startAuction = async () => {
    try {
      await api.post(`/auctions/${auctionId}/start`);
      toast.success('Auction started!');
      fetchAuction();
    } catch (error) {
      toast.error('Failed to start auction');
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
          <h3 className="text-xl font-heading font-bold text-slate-900 mb-4">Live Bidding</h3>
          {bids.length === 0 ? (
            <div className="text-center py-12 text-slate-500" data-testid="no-bids">
              No bids received yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Rank
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Supplier
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Total Amount
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Delivery Days
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-slate-700 uppercase tracking-wide">
                      Last Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bids
                    .sort((a, b) => a.rank - b.rank)
                    .map((bid) => (
                      <tr
                        key={bid.id}
                        className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${latestBidId === bid.id ? 'animate-bid-flash' : ''}`}
                        data-testid={`bid-row-${bid.id}`}
                      >
                        <td className="py-4 px-4">
                          <span className={getRankBadge(bid.rank)}>
                            {bid.rank === 1 && <Trophy className="w-3 h-3 mr-1" />}
                            L{bid.rank}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-900">{bid.supplier_name || 'N/A'}</td>
                        <td className="py-4 px-4 text-right font-mono font-bold text-lg text-slate-900">
                          ₹{(bid.total_amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-4 px-4 text-right text-slate-600">{bid.delivery_days} days</td>
                        <td className="py-4 px-4 text-right text-sm text-slate-500">
                          {bid.updated_at ? formatDistanceToNow(new Date(bid.updated_at), { addSuffix: true }) : 'Just now'}
                        </td>
                      </tr>
                    ))}
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