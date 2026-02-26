import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Clock, Play, Copy, Trophy, Zap, Sparkles, Info, StopCircle, Download } from 'lucide-react';
import { io } from 'socket.io-client';
import { formatDistanceToNow } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const downloadAuditReport = async () => {
    if (!auction || bidHistory.length === 0) {
      toast.error('Cannot generate report: No bids available.');
      return;
    }

    const doc = new jsPDF();

    // Document Header
    doc.setFontSize(22);
    doc.setTextColor(33, 37, 41);
    doc.text('BidFlow - Reverse Auction Audit Report', 14, 20);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Auction ID: ${auction.id}`, 14, 30);
    doc.text(`Title: ${auction.title}`, 14, 36);
    doc.text(`Reference No: ${auction.reference_number || 'N/A'}`, 14, 42);
    const dateStr = new Date().toLocaleString('en-IN');
    doc.text(`Report Generated On: ${dateStr}`, 14, 48);

    // Summary Section
    const totalEstimated = (auction.items || []).reduce((sum, item) => sum + ((item.start_price || 0) * (item.quantity || 0)), 0) || 0;

    const l1Bid = auction.current_l1 || totalEstimated;
    const savings = Math.max(0, totalEstimated - l1Bid);
    const savingsPercent = totalEstimated > 0 ? ((savings / totalEstimated) * 100).toFixed(2) : '0';

    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41);
    doc.text('Auction Summary', 14, 60);

    doc.autoTable({
      startY: 65,
      head: [['Metric', 'Value']],
      body: [
        ['Total Suppliers Invited', `${(auction.suppliers || []).length}`],
        ['Total Bids Received', `${bids.length}`],
        ['Total Auction Ceiling', `Rs. ${totalEstimated.toLocaleString('en-IN')}`],
        ['Final L1 Bid', `Rs. ${l1Bid.toLocaleString('en-IN')}`],
        ['Total Savings', `Rs. ${savings.toLocaleString('en-IN')} (${savingsPercent}%)`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
    });

    let nextY = doc.previousAutoTable.finalY || 65;

    // Capture Chart if exists
    const chartElem = document.getElementById('bids-trend-chart');
    if (chartElem) {
      try {
        const canvas = await html2canvas(chartElem, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        doc.setFontSize(14);
        doc.setTextColor(33, 37, 41);
        doc.text('L1 Trend Chart', 14, nextY + 15);
        doc.addImage(imgData, 'PNG', 14, nextY + 20, 180, 80);
        nextY += 105;
      } catch (err) {
        console.error("Failed to capture chart", err);
      }
    }

    // Check page break
    if (nextY > 250) {
      doc.addPage();
      nextY = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(33, 37, 41);
    doc.text('Comprehensive Bidding History', 14, nextY + 15);

    const tableData = bidHistory.map(entry => {
      const ts = new Date(entry.timestamp);
      return [
        entry.round,
        ts.toLocaleString('en-IN'),
        entry.supplier_name,
        `Rs. ${fmtPrice(entry.unit_price_avg)}`,
        `Rs. ${fmtPrice(entry.total_amount)}`,
        entry.decrement > 0 ? `Rs. ${fmtPrice(entry.decrement)}` : '-',
        `Rs. ${fmtPrice(entry.l1_unit_price)}`,
        entry.l1_supplier
      ];
    });

    doc.autoTable({
      startY: nextY + 20,
      head: [['Rnd', 'Time', 'Supplier', 'Unit', 'Total Amount', 'Drop', 'L1 After', 'L1 Supplier']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [51, 65, 85] },
      styles: { fontSize: 8 },
    });

    // Save
    doc.save(`BidFlow-Audit-Report-${auction.reference_number || auction.id}.pdf`);
    toast.success('Audit Report downloaded successfully!');
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

  // Chart Data Preparation
  const chartData = [...bidHistory].reverse().map((bid, index) => {
    return {
      name: `Bid ${index + 1}`,
      l1_price: bid.l1_unit_price,
      supplier: bid.l1_supplier,
      amount: bid.total_amount,
    };
  });

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
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Status
              </div>
              {auction.status === 'completed' && (
                <Button onClick={downloadAuditReport} size="sm" className="bg-indigo-600 hover:bg-indigo-700 h-8 px-3 text-xs text-white">
                  <Download className="w-3 h-3 mr-1" /> Audit Report
                </Button>
              )}
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
              const totalEstimated = (auction.items || []).reduce((sum, item) => sum + ((item.start_price || 0) * (item.quantity || 0)), 0) || 0;
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

        {bidHistory.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 mb-8" id="bids-trend-chart">
            <h3 className="text-xl font-heading font-bold text-slate-900 mb-6">L1 Price Trend</h3>
            <div className="h-80 w-full pr-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                  />
                  <RechartsTooltip
                    formatter={(value, name) => [`₹${value.toLocaleString('en-IN')}`, 'L1 Unit Price']}
                    labelStyle={{ color: '#0F172A', fontWeight: 'bold' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Line type="monotone" dataKey="l1_price" stroke="#4F46E5" strokeWidth={3} dot={{ r: 4, fill: '#4F46E5', strokeWidth: 2, stroke: 'white' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default LiveAuction;