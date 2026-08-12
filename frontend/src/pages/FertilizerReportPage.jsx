import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Share2, Sprout, AlertCircle, Droplets, Leaf, Calendar, Wallet } from 'lucide-react';
import { getFertilizerPlan } from '../utils/fertilizerLogic';
import { generateFertilizerPDF } from '../utils/pdfExport';
import toast from 'react-hot-toast';
import CustomSelect from '../components/CustomSelect';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useEffect } from 'react';

const CROPS = ["Wheat", "Rice", "Cotton", "Sugarcane", "Maize", "Tomato", "Potato", "Onion"];
const SOIL_TYPES = ["sandy", "loamy", "clayey", "black soil", "red soil", "alluvial", "laterite", "not sure"];
const GROWTH_STAGES = ["sowing", "seedling", "vegetative", "tillering", "flowering", "fruiting", "maturity"];

const FertilizerReportPage = () => {
  const { token } = useAuth();
  const [formData, setFormData] = useState({
    crop: 'Wheat',
    landArea: '',
    unit: 'acre',
    soilType: 'not sure',
    growthStage: 'sowing',
    irrigationType: 'Irrigated',
    previousCrop: '',
    season: 'Rabi',
    budgetPreference: 'Standard',
    soilTest: { N: '', P: '', K: '', pH: '' }
  });
  const [showSoilTest, setShowSoilTest] = useState(false);
  const [report, setReport] = useState(null);

  useEffect(() => {
    // Auto-detect season based on current month
    const month = new Date().getMonth(); // 0-11
    let defaultSeason = 'Zaid';
    if (month >= 5 && month <= 9) defaultSeason = 'Kharif'; // June-Oct
    else if (month >= 10 || month <= 2) defaultSeason = 'Rabi'; // Nov-March
    
    setFormData(prev => ({ ...prev, season: defaultSeason }));

    // Fetch profile for pre-filling NPK if token exists
    if (token) {
      axios.get(`${import.meta.env.VITE_API_URL}/api/farmer/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(response => {
        if (response.data) {
          setFormData(prev => {
            const newSoilTest = { ...prev.soilTest };
            if (response.data.soil_n !== null) newSoilTest.N = response.data.soil_n;
            if (response.data.soil_p !== null) newSoilTest.P = response.data.soil_p;
            if (response.data.soil_k !== null) newSoilTest.K = response.data.soil_k;
            if (response.data.soil_ph !== null) newSoilTest.pH = response.data.soil_ph;
            return { ...prev, soilTest: newSoilTest };
          });
        }
      }).catch(err => console.error("Failed to fetch profile", err));
    }
  }, [token]);

  const handleInputChange = (e) => {
    // Check if e is an event object (from standard inputs) or just a value string (from CustomSelect)
    if (e && e.target) {
      const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const setFormValue = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSoilTestChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      soilTest: { ...prev.soilTest, [name]: value }
    }));
  };

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!formData.landArea || formData.landArea <= 0) {
      toast.error("Please enter a valid land area greater than 0.");
      return;
    }

    try {
      const plan = getFertilizerPlan(
        formData.crop,
        formData.growthStage,
        parseFloat(formData.landArea),
        formData.unit,
        {
          soilTestData: showSoilTest ? formData.soilTest : null,
          irrigationType: formData.irrigationType,
          previousCrop: formData.previousCrop,
          season: formData.season,
          budgetPreference: formData.budgetPreference
        }
      );
      
      setReport({
        ...formData,
        ...plan
      });
      
      toast.success("Report generated successfully!");
    } catch (err) {
      toast.error(err.message || "Failed to generate report.");
    }
  };

  const handleExportPDF = () => {
    if (!report) return;
    try {
      generateFertilizerPDF(report);
      toast.success("PDF Downloaded!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  };

  const handleShare = async () => {
    if (!report) return;
    
    const shareText = `Fertilizer Recommendation for ${report.crop} (${report.landArea} ${report.unit}s):\n` +
      report.fertilizers.map(f => `- ${f.name}: ${f.dosage} (${f.timing})`).join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'AgriVision Fertilizer Report',
          text: shareText,
        });
        toast.success("Shared successfully!");
      } catch (err) {
        if (err.name !== 'AbortError') {
          toast.error("Failed to share.");
        }
      }
    } else {
      // Fallback
      navigator.clipboard.writeText(shareText);
      toast.success("Report summary copied to clipboard!");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12 animate-fade-in px-4 md:px-0">
      
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-farm-primary flex items-center justify-center shadow-lg">
          <Sprout className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-extrabold text-farm-primary dark:text-farm-accent-gold">Fertilizer Report</h1>
          <p className="text-slate-600 dark:text-slate-400 font-medium">Generate customized fertilizer plans for your field.</p>
        </div>
      </div>

      <div className="flex flex-col gap-8">
        {/* Form Section */}
        <motion.div 
          className="glass-panel p-6 overflow-visible"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h2 className="text-xl font-bold text-farm-primary dark:text-white mb-6">Field Details</h2>
          <form onSubmit={handleGenerate} className="space-y-5">
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Crop</label>
                <CustomSelect 
                  value={formData.crop} 
                  onChange={(val) => setFormValue('crop', val)} 
                  options={CROPS.map(c => ({ value: c, label: c }))} 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between" title="Helps adjust nitrogen recommendations if a legume was grown.">
                  <span>Previous Crop Sown</span>
                  <span className="text-[10px] font-normal text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Optional</span>
                </label>
                <CustomSelect 
                  value={formData.previousCrop} 
                  onChange={(val) => setFormValue('previousCrop', val)} 
                  options={[
                    { value: '', label: 'None / Fallow' },
                    { value: 'Soybean', label: 'Soybean' },
                    { value: 'Gram', label: 'Gram (Chickpea)' },
                    { value: 'Wheat', label: 'Wheat' },
                    { value: 'Maize', label: 'Maize' },
                    { value: 'Other', label: 'Other Non-Legume' }
                  ]}
                  placeholder="Select previous crop"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Land Area</label>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    step="0.01" 
                    name="landArea" 
                    value={formData.landArea} 
                    onChange={handleInputChange} 
                    className="glass-input w-full h-11"
                    placeholder="e.g. 2.5"
                    required
                  />
                  <div className="w-1/3">
                    <CustomSelect 
                      value={formData.unit} 
                      onChange={(val) => setFormValue('unit', val)} 
                      options={[
                        { value: 'acre', label: 'Acres' },
                        { value: 'hectare', label: 'Hectares' }
                      ]}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Growth Stage</label>
                <CustomSelect 
                  value={formData.growthStage} 
                  onChange={(val) => setFormValue('growthStage', val)} 
                  options={GROWTH_STAGES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Soil Type</label>
                <CustomSelect 
                  value={formData.soilType} 
                  onChange={(val) => setFormValue('soilType', val)} 
                  options={SOIL_TYPES.map(s => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))} 
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Season</label>
                <CustomSelect 
                  icon={<Calendar className="w-4 h-4" />}
                  value={formData.season} 
                  onChange={(val) => setFormValue('season', val)} 
                  options={[
                    { value: 'Kharif', label: 'Kharif' },
                    { value: 'Rabi', label: 'Rabi' },
                    { value: 'Zaid', label: 'Zaid' }
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Irrigation</label>
                <CustomSelect 
                  icon={<Droplets className="w-4 h-4" />}
                  value={formData.irrigationType} 
                  onChange={(val) => setFormValue('irrigationType', val)} 
                  options={[
                    { value: 'Irrigated', label: 'Irrigated' },
                    { value: 'Rainfed', label: 'Rainfed' },
                    { value: 'Drip', label: 'Drip' },
                    { value: 'Sprinkler', label: 'Sprinkler' }
                  ]}
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showSoilTest} 
                  onChange={(e) => setShowSoilTest(e.target.checked)} 
                  className="rounded text-farm-primary focus:ring-farm-primary border-slate-300 bg-white/50"
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">I have latest soil data</span>
              </label>
            </div>

            {showSoilTest && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }} 
                animate={{ height: 'auto', opacity: 1 }} 
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 bg-slate-50 dark:bg-black/20 p-4 rounded-xl border border-slate-200 dark:border-white/10"
              >
                {['N', 'P', 'K', 'pH'].map(nutrient => (
                  <div key={nutrient}>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">{nutrient} Level</label>
                    <input 
                      type="number" 
                      step="0.1"
                      name={nutrient} 
                      value={formData.soilTest[nutrient]} 
                      onChange={handleSoilTestChange} 
                      className="glass-input w-full h-9 text-sm px-2 bg-white/70 dark:bg-slate-800/70"
                      placeholder="e.g. 50"
                    />
                  </div>
                ))}
                <div className="col-span-2 sm:col-span-4 mt-1 text-xs text-slate-500 italic flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Note: Values will adjust fertilizer NPK recommendations.
                </div>
              </motion.div>
            )}

            <button type="submit" className="glass-button w-full mt-6 py-3 flex items-center justify-center gap-2">
              <Sprout className="w-5 h-5" />
              Generate Report
            </button>
          </form>
        </motion.div>


        {/* Report Section */}
        <motion.div 
          className="glass-panel overflow-visible"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1 }}
        >
          {report ? (
            <div className="glass-panel overflow-visible p-6 h-full flex flex-col relative">
              {/* Decorative background element */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-farm-primary/5 dark:bg-farm-accent-gold/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 relative z-10">
                <div>
                  <h2 className="text-2xl font-bold text-farm-primary dark:text-white">Recommendation Report</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {report.crop} • {report.landArea} {report.unit}(s) • {report.growthStage} stage
                  </p>
                </div>
                
                {report.found && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button onClick={handleShare} className="glass-button !bg-white/40 dark:!bg-white/10 flex-1 sm:flex-none flex justify-center items-center gap-2 text-sm">
                      <Share2 className="w-4 h-4" /> Share
                    </button>
                    <button onClick={handleExportPDF} className="glass-button flex-1 sm:flex-none flex justify-center items-center gap-2 text-sm !bg-farm-primary !text-white">
                      <Download className="w-4 h-4" /> Save PDF
                    </button>
                  </div>
                )}
              </div>

              {report.found ? (
                <div className="relative z-10 flex-1">
                  <div className="overflow-x-auto rounded-xl border border-white/20 dark:border-white/10 shadow-sm bg-white/40 dark:bg-[#1B2A17]/40 mb-6">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-farm-primary/10 dark:bg-farm-primary/30">
                          <th className="p-4 text-sm font-semibold text-farm-primary dark:text-farm-accent-gold border-b border-white/20 dark:border-white/5">Fertilizer</th>
                          <th className="p-4 text-sm font-semibold text-farm-primary dark:text-farm-accent-gold border-b border-white/20 dark:border-white/5">Dosage</th>
                          <th className="p-4 text-sm font-semibold text-farm-primary dark:text-farm-accent-gold border-b border-white/20 dark:border-white/5">Method</th>
                          <th className="p-4 text-sm font-semibold text-farm-primary dark:text-farm-accent-gold border-b border-white/20 dark:border-white/5">Timing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.fertilizers.map((f, i) => (
                          <tr key={i} className="border-b border-white/10 dark:border-white/5 last:border-0 hover:bg-white/20 dark:hover:bg-white/5 transition-colors">
                            <td className="p-4 text-sm font-medium text-slate-800 dark:text-slate-200">{f.name}</td>
                            <td className="p-4 text-sm text-slate-700 dark:text-slate-300 font-semibold">{f.dosage}</td>
                            <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{f.method}</td>
                            <td className="p-4 text-sm text-slate-600 dark:text-slate-400">{f.timing}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {report.notes && report.notes.length > 0 && (
                    <div className="bg-[#FAF3E0]/50 dark:bg-[#2A3F24]/50 rounded-xl p-5 border border-farm-primary/20 dark:border-farm-primary/30">
                      <h4 className="font-bold text-farm-primary dark:text-farm-accent-gold flex items-center gap-2 mb-3">
                        <AlertCircle className="w-4 h-4" /> Important Notes
                      </h4>
                      <ul className="space-y-2">
                        {report.notes.map((note, idx) => (
                          <li key={idx} className="text-sm text-slate-700 dark:text-slate-300 flex items-start gap-2">
                            <span className="text-farm-primary dark:text-farm-accent-gold mt-0.5">•</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white/20 dark:bg-black/20 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                  <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                    <Sprout className="w-8 h-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">{report.message}</h3>
                  <p className="text-sm text-slate-500 max-w-md">Try selecting a different crop or growth stage, or check back later for updated recommendations.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card p-6 h-full min-h-[400px] flex flex-col items-center justify-center text-center opacity-70">
              <div className="w-20 h-20 rounded-full bg-farm-primary/10 dark:bg-farm-primary/20 flex items-center justify-center mb-6">
                <Sprout className="w-10 h-10 text-farm-primary dark:text-farm-accent-gold" />
              </div>
              <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">Ready to Plan</h3>
              <p className="text-slate-500 dark:text-slate-400 max-w-sm">Enter your field details above and click Generate Report to see your customized fertilizer plan.</p>
            </div>
          )}
        </motion.div>

      
        </div>
    </div>
  );
};

export default FertilizerReportPage;
