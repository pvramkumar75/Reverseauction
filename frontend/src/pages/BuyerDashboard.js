import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Plus, Zap, Clock, IndianRupee, Users } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

const BuyerDashboard = () => {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuctions();
  }, []);

  const fetchAuctions = async () => {
    try {
      const response = await api.get('/auctions/all');
      setAuctions(response.data);
    } catch (error) {
      toast.error('Failed to load auctions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const badges = {
      draft: 'bg-slate-100 text-slate-700 border-slate-200',
      active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      completed: 'bg-slate-200 text-slate-600 border-slate-300',
    };
    return badges[status] || badges.draft;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-heading font-bold text-slate-900">BidFlow</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-4xl font-heading font-bold text-slate-900 mb-2">
              Your Auctions
            </h2>
            <p className="text-lg text-slate-600">Manage and monitor all your reverse auctions</p>
          </div>
          <Button
            size="lg"
            onClick={() => navigate('/auctions/create')}
            className="h-12 px-8 text-base font-medium shadow-md hover:shadow-lg transition-all"
            data-testid="create-auction-button"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Auction
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-lg text-slate-600">Loading auctions...</div>
          </div>
        ) : auctions.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-12 text-center" data-testid="empty-state">
            <img
              src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?q=80&w=2000&auto=format&fit=crop"
              alt="Empty state"
              className="w-64 h-48 object-cover rounded-lg mx-auto mb-6 opacity-50"
            />
            <h3 className="text-2xl font-heading font-bold text-slate-900 mb-2">
              No auctions yet
            </h3>
            <p className="text-slate-600 mb-6">
              Create your first reverse auction to start receiving competitive bids from suppliers
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/auctions/create')}
              className="h-12 px-8 text-base font-medium"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create First Auction
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="auctions-grid">
            {auctions.map((auction) => (
              <div
                key={auction.id}
                onClick={() => navigate(`/auctions/${auction.id}`)}
                className="bg-white rounded-xl border border-slate-100 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer p-6"
                data-testid={`auction-card-${auction.id}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-xl font-heading font-bold text-slate-900">
                    {auction.title}
                  </h3>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusBadge(
                      auction.status
                    )}`}
                  >
                    {auction.status.toUpperCase()}
                  </span>
                </div>

                <p className="text-sm text-slate-600 mb-4 line-clamp-2">
                  {auction.description}
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-slate-600">
                    <Users className="w-4 h-4 mr-2 text-slate-400" />
                    {(auction.suppliers || []).length} suppliers invited
                  </div>
                  <div className="flex items-center text-slate-600">
                    <IndianRupee className="w-4 h-4 mr-2 text-slate-400" />
                    <span className="font-mono">Start: ₹{(auction.config?.start_price || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex items-center text-slate-600">
                    <Clock className="w-4 h-4 mr-2 text-slate-400" />
                    {auction.config?.duration_minutes || 0} minutes
                  </div>
                  {auction.current_l1 && (
                    <div className="flex items-center text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded mt-1">
                      <Zap className="w-4 h-4 mr-2" />
                      Current L1: ₹{auction.current_l1.toLocaleString('en-IN')}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
                  Created {auction.created_at ? formatDistanceToNow(new Date(auction.created_at), { addSuffix: true }) : 'Recently'}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default BuyerDashboard;