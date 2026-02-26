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
                    Payment Terms *
                  </Label>
                  <select
                    id="payment_terms"
                    name="payment_terms"
                    value={formData.payment_terms}
                    onChange={handleChange}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="payment-terms-input"
                  >
                    <option value="">Select Payment Terms</option>
                    <option value="Advance">Advance</option>
                    <option value="30 Days Credit">30 Days Credit</option>
                    <option value="45 Days Credit">45 Days Credit</option>
                    <option value="60 Days Credit">60 Days Credit</option>
                    <option value="30 Days PDC">30 Days PDC</option>
                    <option value="100% against PI">100% against PI</option>
                    <option value="30%-60%-10%">30%-60%-10%</option>
                    <option value="50%-50%">50%-50%</option>
                    <option value="90%-10%">90%-10%</option>
                    <option value="10%-90%">10%-90%</option>
                    <option value="40%-60%">40%-60%</option>
                    <option value="100% against Delivery">100% against Delivery</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="delivery_terms" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                    Delivery Terms
                  </Label>
                  <select
                    id="delivery_terms"
                    name="delivery_terms"
                    value={formData.delivery_terms}
                    onChange={handleChange}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="delivery-terms-input"
                  >
                    <option value="">Select Delivery Terms</option>
                    <option value="Ex-Works">Ex-Works</option>
                    <option value="FOB">FOB (Free on Board)</option>
                    <option value="CIF">CIF (Cost, Insurance & Freight)</option>
                    <option value="DDP">DDP (Delivered Duty Paid)</option>
                    <option value="FCA">FCA (Free Carrier)</option>
                    <option value="CFR">CFR (Cost & Freight)</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="freight_condition" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                    Freight Condition *
                  </Label>
                  <select
                    id="freight_condition"
                    name="freight_condition"
                    value={formData.freight_condition}
                    onChange={handleChange}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="freight-condition-input"
                  >
                    <option value="">Select Freight</option>
                    <option value="FOR">FOR (Free on Road)</option>
                    <option value="Ex-Works">Ex-Works</option>
                    <option value="Inclusive">Inclusive</option>
                    <option value="Extra">Extra</option>
                  </select>
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
                      <select
                        value={item.unit}
                        onChange={(e) => updateItem(index, 'unit', e.target.value)}
                        className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <option value="PCS">PCS (Pieces)</option>
                        <option value="KG">KG (Kilograms)</option>
                        <option value="MT">MT (Metric Ton)</option>
                        <option value="M">M (Meters)</option>
                        <option value="L">L (Liters)</option>
                        <option value="Nos">Nos (Numbers)</option>
                        <option value="Set">Set</option>
                        <option value="Box">Box</option>
                        <option value="Sq.m">Sq.m (Sq. Meters)</option>
                      </select>
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

            {/* Estimated Total Preview */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 mb-6">
              <div className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">Estimated Total Value</div>
              <div className="text-2xl font-mono font-bold text-indigo-700">
                ₹{(config.start_price * items.reduce((sum, item) => sum + (item.quantity || 0), 0)).toLocaleString('en-IN')}
              </div>
              <div className="text-xs text-indigo-400 mt-1">
                {items.map((item, i) => `${item.item_code || `Item ${i + 1}`}: ${item.quantity} ${item.unit} × ₹${config.start_price}`).join(' | ')}
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <Label htmlFor="start_price" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Ceiling Price per Unit (₹) *
                </Label>
                <Input
                  id="start_price"
                  name="start_price"
                  type="number"
                  step="0.01"
                  value={config.start_price}
                  onChange={handleConfigChange}
                  placeholder="e.g., 255"
                  className="h-12"
                  data-testid="start-price-input"
                />
                <p className="text-sm text-slate-500 mt-1">
                  Maximum unit price set by buyer. Suppliers must bid below this per-unit price.
                </p>
              </div>

              <div>
                <Label htmlFor="min_decrement" className="text-sm font-semibold text-slate-700 mb-2 block uppercase tracking-wide">
                  Minimum Decrement per Unit (₹) *
                </Label>
                <Input
                  id="min_decrement"
                  name="min_decrement"
                  type="number"
                  step="0.01"
                  value={config.min_decrement}
                  onChange={handleConfigChange}
                  placeholder="e.g., 1"
                  className="h-12"
                  data-testid="min-decrement-input"
                />
                <p className="text-sm text-slate-500 mt-1">
                  Each new bid must be at least this much lower (per unit) than the current L1.
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
                <p className="text-sm text-slate-500 mt-1">
                  How long the auction will run. Auto-extends by 2 minutes if a bid is placed near the end.
                </p>
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
