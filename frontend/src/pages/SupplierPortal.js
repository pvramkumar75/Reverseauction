import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Zap, Package, FileText, IndianRupee } from 'lucide-react';


const SupplierPortal = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchAuction = async () => {
    try {
      const response = await api.get(`/supplier/${token}`);
      setAuction(response.data);
    } catch (error) {
      toast.error('Invalid supplier link');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading auction details...</div>
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
          <div className="flex items-center gap-3">
            <Zap className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-3xl font-heading font-bold text-slate-900">BidFlow</h1>
              <p className="text-sm text-slate-600">Supplier Portal</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 mb-8" data-testid="welcome-section">
          <h2 className="text-2xl font-heading font-bold text-slate-900 mb-2">
            Welcome, {auction.supplier_info?.name || 'Supplier'}!
          </h2>
          <p className="text-slate-600">
            You've been invited to participate in a reverse auction. Review the requirements below
            and submit your best quote.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 mb-8" data-testid="auction-details">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-heading font-bold text-slate-900">Auction Details</h3>
          </div>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Title</span>
              <p className="text-slate-900">{auction.title}</p>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Reference Number</span>
              <p className="text-slate-900">{auction.reference_number}</p>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Description</span>
              <p className="text-slate-900">{auction.description}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              <div>
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Payment Terms</span>
                <p className="text-slate-900">{auction.payment_terms}</p>
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Delivery Terms</span>
                <p className="text-slate-900">{auction.delivery_terms}</p>
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Freight Condition</span>
                <p className="text-slate-900">{auction.freight_condition}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 mb-8" data-testid="items-section">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-heading font-bold text-slate-900">Items Required</h3>
          </div>
          <div className="space-y-4">
            {(auction.items || []).map((item, idx) => (
              <div key={idx} className="border border-slate-200 rounded-lg p-4" data-testid={`item-${idx}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-bold text-slate-900">{item.item_code}</div>
                    <div className="text-sm text-slate-600">{item.description}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-slate-500">Quantity:</span>
                    <span className="ml-2 font-semibold text-slate-900">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Ceiling:</span>
                    <span className="ml-2 font-mono font-semibold text-slate-900">
                      ₹{(item.start_price || item.estimated_price || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Min Decr:</span>
                    <span className="ml-2 font-mono font-semibold text-slate-900">
                      ₹{(item.min_decrement || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8 mb-8" data-testid="config-section">
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-heading font-bold text-slate-900">Auction Rules</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Starting Ceiling</span>
              <p className="text-2xl font-mono font-bold text-slate-900">
                {auction.config?.start_price > 0
                  ? `₹${auction.config.start_price.toLocaleString('en-IN')}`
                  : 'Item-wise'}
              </p>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Min. Decrement</span>
              <p className="text-2xl font-mono font-bold text-slate-900">
                {auction.config?.min_decrement > 0
                  ? `₹${auction.config.min_decrement.toLocaleString('en-IN')}`
                  : 'Item-wise'}
              </p>
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Duration</span>
              <p className="text-2xl font-mono font-bold text-slate-900">
                {auction.config?.duration_minutes || 0} min
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => navigate(`/supplier/${token}/bid`)}
            className="h-14 px-12 text-lg font-medium shadow-lg hover:shadow-xl transition-all"
            data-testid="submit-quote-button"
          >
            Submit Your Quote
          </Button>
        </div>
      </main>
    </div>
  );
};

export default SupplierPortal;