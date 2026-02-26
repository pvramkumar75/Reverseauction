import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/utils/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, Plus, X, Zap, Upload, Copy } from 'lucide-react';

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
    { name: '', contact_person: '', email: '', phone: '', gst_no: '', msme: 'No', approved_vendor: false, remarks: '' },
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
    const { name, value } = e.target;
    const parsed = Math.round(parseFloat(value) * 100) / 100 || 0; // Round to 2 decimals
    setConfig(prev => ({ ...prev, [name]: parsed }));
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

  const handlePasteItems = (e) => {
    e.preventDefault();
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedData = clipboardData.getData('Text');
    if (!pastedData) return;

    const rows = pastedData.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');
    const newItems = rows.map((row) => {
      const separator = row.includes('\t') ? '\t' : ',';
      const cells = row.split(separator);
      return {
        item_code: cells[0]?.trim() || '',
        description: cells[1]?.trim() || '',
        quantity: parseFloat(cells[2]) || 0,
        unit: cells[3]?.trim() || 'PCS',
        estimated_price: parseFloat(cells[4]) || 0
      };
    });

    if (items.length === 1 && !items[0].item_code && !items[0].description) {
      setItems(newItems);
    } else {
      setItems([...items, ...newItems]);
    }
    toast.success(`Pasted ${newItems.length} items`);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvData = event.target.result;
      const rows = csvData.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');

      const newItems = rows.map(row => {
        const cells = row.split(',');
        return {
          item_code: cells[0]?.trim() || '',
          description: cells[1]?.trim() || '',
          quantity: parseFloat(cells[2]) || 0,
          unit: cells[3]?.trim() || 'PCS',
          estimated_price: parseFloat(cells[4]) || 0
        };
      });

      if (items.length === 1 && !items[0].item_code && !items[0].description) {
        setItems(newItems);
      } else {
        setItems([...items, ...newItems]);
      }
      toast.success(`Uploaded ${newItems.length} items from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePasteSuppliers = (e) => {
    e.preventDefault();
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedData = clipboardData.getData('Text');
    if (!pastedData) return;

    const rows = pastedData.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');
    const newSuppliers = rows.map((row) => {
      const separator = row.includes('\t') ? '\t' : ',';
      const cells = row.split(separator);
      return {
        contact_person: cells[0]?.trim() || '',
        name: cells[1]?.trim() || '',
        email: cells[2]?.trim() || '',
        phone: cells[3]?.trim() || '',
        gst_no: cells[4]?.trim() || '',
        msme: cells[5]?.trim() || 'No',
        approved_vendor: cells[6]?.trim().toLowerCase() === 'yes',
        remarks: cells[7]?.trim() || ''
      };
    });

    if (suppliers.length === 1 && !suppliers[0].name && !suppliers[0].email) {
      setSuppliers(newSuppliers);
    } else {
      setSuppliers([...suppliers, ...newSuppliers]);
    }
    toast.success(`Pasted ${newSuppliers.length} suppliers`);
  };

  const handleSupplierFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvData = event.target.result;
      const rows = csvData.split(/\r\n|\n|\r/).filter(row => row.trim() !== '');

      const newSuppliers = rows.map(row => {
        const cells = row.split(',');
        return {
          contact_person: cells[0]?.trim() || '',
          name: cells[1]?.trim() || '',
          email: cells[2]?.trim() || '',
          phone: cells[3]?.trim() || '',
          gst_no: cells[4]?.trim() || '',
          msme: cells[5]?.trim() || 'No',
          approved_vendor: cells[6]?.trim().toLowerCase() === 'yes',
          remarks: cells[7]?.trim() || ''
        };
      });

      if (suppliers.length === 1 && !suppliers[0].name && !suppliers[0].email) {
        setSuppliers(newSuppliers);
      } else {
        setSuppliers([...suppliers, ...newSuppliers]);
      }
      toast.success(`Uploaded ${newSuppliers.length} suppliers from CSV`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const addSupplier = () => {
    setSuppliers([...suppliers, { name: '', contact_person: '', email: '', phone: '', gst_no: '', msme: 'No', approved_vendor: false, remarks: '' }]);
  };

  const removeSupplier = (index) => {
    if (suppliers.length > 1) {
      setSuppliers(suppliers.filter((_, i) => i !== index));
    }
  };

  const updateSupplier = (index, field, value) => {
    const updated = [...suppliers];
    if (field === 'approved_vendor') {
      updated[index][field] = value;
    } else {
      updated[index][field] = value;
    }
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
      console.log('Creating auction with config:', JSON.stringify(config));
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

        {/* Step 2: Items Grid */}
        {step === 2 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8" data-testid="step-items">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-heading font-bold text-slate-900">Line Items Grid</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Add items manually or bulk paste/upload. <br />
                  <span className="font-semibold text-slate-600">Format:</span> Item Code, Description, Qty, Unit, Estimated Price
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => document.getElementById('csv-upload').click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                </Button>
                <input
                  type="file"
                  id="csv-upload"
                  accept=".csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />

                <Button variant="outline" onClick={addItem}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Row
                </Button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-sm" onPaste={handlePasteItems}>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase tracking-wide text-xs">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Item Code *</th>
                    <th className="px-4 py-3 font-semibold w-1/3">Description *</th>
                    <th className="px-4 py-3 font-semibold w-24">Qty</th>
                    <th className="px-4 py-3 font-semibold w-28">Unit</th>
                    <th className="px-4 py-3 font-semibold w-32">Est. Price</th>
                    <th className="px-4 py-3 font-semibold w-32 text-right">Total</th>
                    <th className="px-4 py-3 font-semibold w-16 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => {
                    const lineTotal = (item.quantity || 0) * (item.estimated_price || 0);
                    const isCodeMissing = step === 2 && !item.item_code;
                    const isDescMissing = step === 2 && !item.description;

                    return (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-2 py-2">
                          <Input
                            value={item.item_code}
                            onChange={(e) => updateItem(index, 'item_code', e.target.value)}
                            placeholder="Code"
                            className={`h-9 text-sm ${isCodeMissing ? 'border-red-300 focus-visible:ring-red-500' : ''}`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            placeholder="Detailed Description"
                            className={`h-9 text-sm ${isDescMissing ? 'border-red-300 focus-visible:ring-red-500' : ''}`}
                          />
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            value={item.quantity || ''}
                            onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                            placeholder="0"
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={item.unit}
                            onChange={(e) => updateItem(index, 'unit', e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="PCS">PCS</option>
                            <option value="KG">KG</option>
                            <option value="MT">MT</option>
                            <option value="M">M</option>
                            <option value="L">L</option>
                            <option value="Nos">Nos</option>
                            <option value="Set">Set</option>
                            <option value="Box">Box</option>
                            <option value="Sq.m">Sq.m</option>
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            value={item.estimated_price || ''}
                            onChange={(e) => updateItem(index, 'estimated_price', e.target.value)}
                            placeholder="0.00"
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="px-4 py-2 text-right font-mono font-medium text-slate-700">
                          {lineTotal > 0 ? `₹${lineTotal.toLocaleString('en-IN')}` : '-'}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {items.length > 1 && (
                            <button
                              onClick={() => removeItem(index)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-right font-bold text-slate-700">
                      Auto Grand Total:
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-bold text-indigo-700 text-base">
                      ₹{items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.estimated_price || 0)), 0).toLocaleString('en-IN')}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-blue-50/50 border border-blue-100 flex items-start gap-3">
              <Copy className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <span className="font-semibold block mb-1">Grid Support Enabled!</span>
                You can easily copy data from Excel (with matching 5 columns) and press <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-xs">Ctrl+V</kbd> anywhere inside this table box to instantly paste multiple line items.
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Suppliers Grid */}
        {step === 3 && (
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-8" data-testid="step-suppliers">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div>
                <h2 className="text-2xl font-heading font-bold text-slate-900">Supplier Invitation Grid</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Invite suppliers manually or bulk paste/upload. <br />
                  <span className="font-semibold text-slate-600">Format:</span> Supplier Name, Company Name, Email, Mobile, GST No, MSME, Approved (Yes/No), Remarks
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={() => document.getElementById('supplier-csv-upload').click()}>
                  <Upload className="w-4 h-4 mr-2" />
                  Upload CSV
                </Button>
                <input
                  type="file"
                  id="supplier-csv-upload"
                  accept=".csv"
                  className="hidden"
                  onChange={handleSupplierFileUpload}
                />

                <Button variant="outline" onClick={addSupplier}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Row
                </Button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg overflow-x-auto shadow-sm" onPaste={handlePasteSuppliers}>
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 uppercase tracking-wide text-xs">
                  <tr>
                    <th className="px-3 py-3 font-semibold">Supplier Name</th>
                    <th className="px-3 py-3 font-semibold w-1/5">Company Name *</th>
                    <th className="px-3 py-3 font-semibold w-1/5">Email *</th>
                    <th className="px-3 py-3 font-semibold">Mobile</th>
                    <th className="px-3 py-3 font-semibold">GST No</th>
                    <th className="px-3 py-3 font-semibold w-24">MSME</th>
                    <th className="px-3 py-3 font-semibold w-24 text-center">Approved Vendor</th>
                    <th className="px-3 py-3 font-semibold w-48">Remarks</th>
                    <th className="px-2 py-3 font-semibold w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppliers.map((supplier, index) => {
                    const isNameMissing = step === 3 && !supplier.name;
                    const isEmailMissing = step === 3 && !supplier.email;

                    return (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="px-1 py-2">
                          <Input
                            value={supplier.contact_person}
                            onChange={(e) => updateSupplier(index, 'contact_person', e.target.value)}
                            placeholder="Supplier Name"
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <Input
                            value={supplier.name}
                            onChange={(e) => updateSupplier(index, 'name', e.target.value)}
                            placeholder="Company Name"
                            className={`h-9 text-sm ${isNameMissing ? 'border-red-300 focus-visible:ring-red-500' : ''}`}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <Input
                            type="email"
                            value={supplier.email}
                            onChange={(e) => updateSupplier(index, 'email', e.target.value)}
                            placeholder="email@domain.com"
                            className={`h-9 text-sm ${isEmailMissing ? 'border-red-300 focus-visible:ring-red-500' : ''}`}
                          />
                        </td>
                        <td className="px-1 py-2">
                          <Input
                            value={supplier.phone}
                            onChange={(e) => updateSupplier(index, 'phone', e.target.value)}
                            placeholder="Mobile"
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <Input
                            value={supplier.gst_no}
                            onChange={(e) => updateSupplier(index, 'gst_no', e.target.value)}
                            placeholder="GST"
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <select
                            value={supplier.msme}
                            onChange={(e) => updateSupplier(index, 'msme', e.target.value)}
                            className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          >
                            <option value="No">No</option>
                            <option value="Yes">Yes</option>
                          </select>
                        </td>
                        <td className="px-1 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={supplier.approved_vendor}
                            onChange={(e) => updateSupplier(index, 'approved_vendor', e.target.checked)}
                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-1 py-2">
                          <Input
                            value={supplier.remarks}
                            onChange={(e) => updateSupplier(index, 'remarks', e.target.value)}
                            placeholder="Remarks"
                            className="h-9 text-sm"
                          />
                        </td>
                        <td className="px-1 py-2 text-center">
                          {suppliers.length > 1 && (
                            <button
                              onClick={() => removeSupplier(index)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-4 rounded-lg bg-blue-50/50 border border-blue-100 flex items-start gap-3">
              <Copy className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <span className="font-semibold block mb-1">Grid Support Enabled!</span>
                You can easily copy data from Excel (with matching 8 columns) and press <kbd className="px-1.5 py-0.5 bg-white border border-blue-200 rounded text-xs">Ctrl+V</kbd> anywhere inside this table box to instantly paste multiple suppliers.
              </div>
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
