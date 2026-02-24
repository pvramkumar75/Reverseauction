import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Plus, X, Zap } from 'lucide-react';

const CreateAuction = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Public access enabled
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    reference_number: '',
    description: '',
    payment_terms: '',
    delivery_terms: '',
    freight_condition: '',
  });

  const [items, setItems] = useState([
    { item_code: '', description: '', quantity: 0, unit: 'PCS', estimated_price: 0 },
  ]);

  const [suppliers, setSuppliers] = useState([
    { name: '', contact_person: '', email: '', phone: '' },
  ]);

  const [config, setConfig] = useState({
    start_price: 0,
    min_decrement: 0,
    duration_minutes: 30,
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleConfigChange = (e) => {
    setConfig({ ...config, [e.target.name]: parseFloat(e.target.value) || 0 });
  };

  const addItem = () => {
    setItems([...items, { item_code: '', description: '', quantity: 0, unit: 'PCS', estimated_price: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = field === 'quantity' || field === 'estimated_price' ? parseFloat(value) || 0 : value;
    setItems(updated);
  };

  const addSupplier = () => {
    setSuppliers([...suppliers, { name: '', contact_person: '', email: '', phone: '' }]);
  };

  const removeSupplier = (index) => {
    if (suppliers.length > 1) {
      setSuppliers(suppliers.filter((_, i) => i !== index));
    }
  };

  const updateSupplier = (index, field, value) => {
    const updated = [...suppliers];
    updated[index][field] = value;
    setSuppliers(updated);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const payload = {
        ...formData,
        items,
        suppliers,
        config,
      };
      const response = await api.post('/auctions', payload);
      toast.success('Auction created successfully!');
      navigate(`/auctions/${response.data.id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create auction');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && (!formData.title || !formData.reference_number)) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (step === 2 && items.some(item => !item.item_code || !item.description)) {
      toast.error('Please fill in all item details');
      return;
    }
    if (step === 3 && suppliers.some(s => !s.name || !s.email)) {
      toast.error('Please fill in supplier name and email');
      return;
    }
    setStep(step + 1);
  };

  const prevStep = () => setStep(step - 1);

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/')} data-testid="back-button">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <Zap className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-heading font-bold text-slate-900">Create New Auction</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {['Basic Info', 'Items', 'Suppliers', 'Configuration'].map((label, idx) => (
              <div key={idx} className="flex items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${step > idx + 1
                    ? 'bg-primary text-white'
                    : step === idx + 1
                      ? 'bg-primary text-white'
                      : 'bg-slate-200 text-slate-500'
                    }`}
                >
                  {idx + 1}
                </div>
                <span className={`ml-2 text-sm font-medium ${step === idx + 1 ? 'text-slate-900' : 'text-slate-500'}`}>
                  {label}
                </span>
                {idx < 3 && <div className="w-12 h-1 bg-slate-200 mx-4"></div>}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8" data-testid="step-basic-info">
            <h2 className="text-2xl font-heading font-bold text-slate-900 mb-6">Auction Details</h2>
            <div className="space-y-6">
              <div>
                <Label htmlFor="title" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Auction Title *
                </Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="e.g., Steel Procurement Q1 2025"
                  className="h-12"
                  data-testid="title-input"
                />
              </div>

              <div>
                <Label htmlFor="reference_number" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Reference Number *
                </Label>
                <Input
                  id="reference_number"
                  name="reference_number"
                  value={formData.reference_number}
                  onChange={handleChange}
                  placeholder="e.g., PO-2025-001"
                  className="h-12"
                  data-testid="reference-input"
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Description
                </Label>
                <Textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Overall requirements and specifications"
                  rows={4}
                  data-testid="description-input"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="payment_terms" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                    Payment Terms
                  </Label>
                  <Input
                    id="payment_terms"
                    name="payment_terms"
                    value={formData.payment_terms}
                    onChange={handleChange}
                    placeholder="e.g., Net 30"
                    className="h-12"
                    data-testid="payment-terms-input"
                  />
                </div>

                <div>
                  <Label htmlFor="delivery_terms" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                    Delivery Terms
                  </Label>
                  <Input
                    id="delivery_terms"
                    name="delivery_terms"
                    value={formData.delivery_terms}
                    onChange={handleChange}
                    placeholder="e.g., FOB"
                    className="h-12"
                    data-testid="delivery-terms-input"
                  />
                </div>

                <div>
                  <Label htmlFor="freight_condition" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                    Freight Condition
                  </Label>
                  <Input
                    id="freight_condition"
                    name="freight_condition"
                    value={formData.freight_condition}
                    onChange={handleChange}
                    placeholder="e.g., Prepaid"
                    className="h-12"
                    data-testid="freight-condition-input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Items */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8" data-testid="step-items">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-heading font-bold text-slate-900">Items</h2>
              <Button onClick={addItem} variant="outline" data-testid="add-item-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="space-y-6">
              {items.map((item, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-6 relative" data-testid={`item-${index}`}>
                  {items.length > 1 && (
                    <button
                      onClick={() => removeItem(index)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-red-600"
                      data-testid={`remove-item-${index}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                        Item Code *
                      </Label>
                      <Input
                        value={item.item_code}
                        onChange={(e) => updateItem(index, 'item_code', e.target.value)}
                        placeholder="SKU/Part Number"
                        className="h-12"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                        Unit
                      </Label>
                      <Input
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        placeholder="PCS, KG, M, etc."
                        className="h-12"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                        Description *
                      </Label>
                      <Textarea
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="Detailed specifications"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                        Quantity
                      </Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        placeholder="0"
                        className="h-12"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                        Estimated Price
                      </Label>
                      <Input
                        type="number"
                        value={item.estimated_price}
                        onChange={(e) => updateItem(index, 'estimated_price', e.target.value)}
                        placeholder="0.00"
                        className="h-12"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Suppliers */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8" data-testid="step-suppliers">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-heading font-bold text-slate-900">Suppliers</h2>
              <Button onClick={addSupplier} variant="outline" data-testid="add-supplier-button">
                <Plus className="w-4 h-4 mr-2" />
                Add Supplier
              </Button>
            </div>

            <div className="space-y-6">
              {suppliers.map((supplier, index) => (
                <div key={index} className="border border-slate-200 rounded-lg p-6 relative" data-testid={`supplier-${index}`}>
                  {suppliers.length > 1 && (
                    <button
                      onClick={() => removeSupplier(index)}
                      className="absolute top-4 right-4 text-slate-400 hover:text-red-600"
                      data-testid={`remove-supplier-${index}`}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                        Company Name *
                      </Label>
                      <Input
                        value={supplier.name}
                        onChange={(e) => updateSupplier(index, 'name', e.target.value)}
                        placeholder="Supplier Inc."
                        className="h-12"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                        Contact Person
                      </Label>
                      <Input
                        value={supplier.contact_person}
                        onChange={(e) => updateSupplier(index, 'contact_person', e.target.value)}
                        placeholder="John Doe"
                        className="h-12"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                        Email *
                      </Label>
                      <Input
                        type="email"
                        value={supplier.email}
                        onChange={(e) => updateSupplier(index, 'email', e.target.value)}
                        placeholder="supplier@company.com"
                        className="h-12"
                      />
                    </div>

                    <div>
                      <Label className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                        Phone
                      </Label>
                      <Input
                        value={supplier.phone}
                        onChange={(e) => updateSupplier(index, 'phone', e.target.value)}
                        placeholder="+1 234 567 8900"
                        className="h-12"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Configuration */}
        {step === 4 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8" data-testid="step-config">
            <h2 className="text-2xl font-heading font-bold text-slate-900 mb-6">Auction Configuration</h2>
            <div className="space-y-6">
              <div>
                <Label htmlFor="start_price" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Starting Price (₹) *
                </Label>
                <Input
                  id="start_price"
                  name="start_price"
                  type="number"
                  value={config.start_price}
                  onChange={handleConfigChange}
                  placeholder="10000"
                  className="h-12"
                  data-testid="start-price-input"
                />
                <p className="text-sm text-slate-500 mt-1">Maximum acceptable price for this auction</p>
              </div>

              <div>
                <Label htmlFor="min_decrement" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Minimum Decrement (₹) *
                </Label>
                <Input
                  id="min_decrement"
                  name="min_decrement"
                  type="number"
                  value={config.min_decrement}
                  onChange={handleConfigChange}
                  placeholder="100"
                  className="h-12"
                  data-testid="min-decrement-input"
                />
                <p className="text-sm text-slate-500 mt-1">
                  Minimum amount by which suppliers must reduce their bid
                </p>
              </div>

              <div>
                <Label htmlFor="duration_minutes" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Duration (Minutes) *
                </Label>
                <Input
                  id="duration_minutes"
                  name="duration_minutes"
                  type="number"
                  value={config.duration_minutes}
                  onChange={handleConfigChange}
                  placeholder="30"
                  className="h-12"
                  data-testid="duration-input"
                />
                <p className="text-sm text-slate-500 mt-1">How long the auction will run once started</p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={step === 1}
            className="h-12 px-8"
            data-testid="prev-button"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          {step < 4 ? (
            <Button onClick={nextStep} className="h-12 px-8" data-testid="next-button">
              Next
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="h-12 px-8"
              data-testid="submit-button"
            >
              {loading ? 'Creating...' : 'Create Auction'}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

export default CreateAuction;
