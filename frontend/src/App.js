import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import BuyerDashboard from '@/pages/BuyerDashboard';
import CreateAuction from '@/pages/CreateAuction';
import LiveAuction from '@/pages/LiveAuction';
import SupplierPortal from '@/pages/SupplierPortal';
import SupplierBidding from '@/pages/SupplierBidding';
import '@/App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BuyerDashboard />} />
        <Route path="/auctions/create" element={<CreateAuction />} />
        <Route path="/auctions/:auctionId" element={<LiveAuction />} />
        <Route path="/supplier/:token" element={<SupplierPortal />} />
        <Route path="/supplier/:token/bid" element={<SupplierBidding />} />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

export default App;