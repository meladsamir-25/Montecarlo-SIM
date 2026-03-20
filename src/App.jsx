import React, { useState, useEffect } from 'react';
import { 
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ReferenceLine,
  BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, Activity, DollarSign, Percent, 
  RotateCcw, Target, Layers, Download, Calculator, Crosshair,
  Flame, AlertTriangle, BarChart3
} from 'lucide-react';

const App = () => {
  // 1. حالة الإدخالات
  const [inputs, setInputs] = useState({
    initialDeposit: 1000,
    winRate: 40,
    riskPerTrade: 1, 
    rewardPerTrade: 2, 
    numTrades: 300,
    numPaths: 500, 
    ruinDrawdown: 50, 
    targetR: 50, 
    positionSizing: 'compounding' 
  });

  const [simulationData, setSimulationData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // دالة تصدير البيانات إلى Excel (CSV)
  const downloadCSV = () => {
    if (!simulationData || simulationData.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "رقم الصفقة,أسوأ 5% (التشاؤمي),المتوسط (الواقعي),أفضل 5% (المتفائل),متوسط التراجع,أسوأ تراجع\n";
    
    simulationData.forEach(row => {
      csvContent += `${row.trade},${row.p5.toFixed(2)},${row.median.toFixed(2)},${row.p95.toFixed(2)},${row.medianDD.toFixed(2)},${row.worstDD.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "MonteCarlo_Quant_Report.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 3. المحرك الكمي (Quant Engine)
  const runSimulation = () => {
    setIsSimulating(true);
    
    setTimeout(() => {
      const numPaths = inputs.numPaths;
      const numTrades = inputs.numTrades;
      const winProb = inputs.winRate / 100;
      const riskRatio = inputs.riskPerTrade / 100;
      const rewardRatio = inputs.rewardPerTrade / 100;
      const initialDeposit = Number(inputs.initialDeposit);
      const ruinLevel = initialDeposit * (1 - (inputs.ruinDrawdown / 100));
      
      const expectancyR = (winProb * (inputs.rewardPerTrade / inputs.riskPerTrade)) - ((1 - winProb) * 1);
      const targetProfitAmount = initialDeposit * riskRatio * inputs.targetR;
      const targetEquity = initialDeposit + targetProfitAmount;

      let ruinedPathsCount = 0;
      let targetHitCount = 0;
      let totalMaxDrawdowns = 0;
      let totalMaxWinStreak = 0;
      let totalMaxLossStreak = 0;
      let absoluteMaxLossStreak = 0;
      let absoluteMaxWinStreak = 0;
      let finalEquities = [];
      
      let stepEquities = Array.from({ length: numTrades + 1 }, () => []);
      let stepDrawdowns = Array.from({ length: numTrades + 1 }, () => []);

      for (let p = 0; p < numPaths; p++) {
        let currentEquity = initialDeposit;
        let isRuined = false;
        let hasHitTarget = false;
        let peakEquity = currentEquity;
        let maxDrawdownForThisPath = 0;
        
        let currentWinStreak = 0;
        let currentLossStreak = 0;
        let pathMaxWinStreak = 0;
        let pathMaxLossStreak = 0;
        
        stepEquities[0].push(currentEquity);
        stepDrawdowns[0].push(0);

        for (let t = 1; t <= numTrades; t++) {
          if (currentEquity <= 0) {
            currentEquity = 0;
            currentLossStreak++;
            currentWinStreak = 0;
            if(currentLossStreak > pathMaxLossStreak) pathMaxLossStreak = currentLossStreak;
          } else {
            const isWin = Math.random() < winProb;
            
            const baseAmountForRisk = inputs.positionSizing === 'compounding' ? currentEquity : initialDeposit;
            const tradeRiskAmount = baseAmountForRisk * riskRatio;
            const tradeRewardAmount = baseAmountForRisk * rewardRatio;

            if (isWin) {
              currentEquity += tradeRewardAmount;
              currentWinStreak++;
              currentLossStreak = 0;
              if (currentWinStreak > pathMaxWinStreak) pathMaxWinStreak = currentWinStreak;
            } else {
              currentEquity -= tradeRiskAmount;
              currentLossStreak++;
              currentWinStreak = 0;
              if (currentLossStreak > pathMaxLossStreak) pathMaxLossStreak = currentLossStreak;
            }
          }

          if (currentEquity > peakEquity) peakEquity = currentEquity;
          const currentDD = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;
          if (currentDD > maxDrawdownForThisPath) maxDrawdownForThisPath = currentDD;

          if (currentEquity <= ruinLevel && !isRuined) isRuined = true;
          if (currentEquity >= targetEquity && !hasHitTarget) hasHitTarget = true;

          stepEquities[t].push(currentEquity);
          stepDrawdowns[t].push(currentDD);
        }

        if (isRuined) ruinedPathsCount++;
        if (hasHitTarget) targetHitCount++;
        totalMaxDrawdowns += maxDrawdownForThisPath;
        
        totalMaxWinStreak += pathMaxWinStreak;
        totalMaxLossStreak += pathMaxLossStreak;
        if (pathMaxWinStreak > absoluteMaxWinStreak) absoluteMaxWinStreak = pathMaxWinStreak;
        if (pathMaxLossStreak > absoluteMaxLossStreak) absoluteMaxLossStreak = pathMaxLossStreak;

        finalEquities.push(currentEquity);
      }

      let chartData = [];
      for (let t = 0; t <= numTrades; t++) {
        stepEquities[t].sort((a, b) => a - b);
        stepDrawdowns[t].sort((a, b) => a - b);
        
        const p5 = stepEquities[t][Math.floor(numPaths * 0.05)]; 
        const p50 = stepEquities[t][Math.floor(numPaths * 0.50)]; 
        const p95 = stepEquities[t][Math.floor(numPaths * 0.95)]; 
        
        const dd50 = stepDrawdowns[t][Math.floor(numPaths * 0.50)];
        const dd95 = stepDrawdowns[t][Math.floor(numPaths * 0.95)];

        chartData.push({
          trade: t,
          median: p50,
          p5: p5,
          p95: p95,
          confidenceBand: [p5, p95],
          medianDD: -dd50, 
          worstDD: -dd95
        });
      }

      setSimulationData(chartData);
      finalEquities.sort((a, b) => a - b);

      const minEq = finalEquities[0];
      const maxEq = finalEquities[numPaths - 1];
      const bucketCount = 15;
      const bucketSize = (maxEq - minEq) / bucketCount;
      
      let distData = Array.from({ length: bucketCount }, (_, i) => ({
        rangeStart: minEq + (i * bucketSize),
        label: `$${Math.round(minEq + (i * bucketSize)).toLocaleString()} - $${Math.round(minEq + ((i + 1) * bucketSize)).toLocaleString()}`,
        count: 0
      }));

      finalEquities.forEach(eq => {
        let bucketIndex = Math.floor((eq - minEq) / bucketSize);
        if (bucketIndex >= bucketCount) bucketIndex = bucketCount - 1; 
        distData[bucketIndex].count++;
      });
      
      setDistributionData(distData);

      setMetrics({
        medianFinal: finalEquities[Math.floor(numPaths * 0.50)],
        worstFinal: finalEquities[0],
        bestFinal: finalEquities[numPaths - 1],
        ruinProbability: (ruinedPathsCount / numPaths) * 100,
        targetHitProbability: (targetHitCount / numPaths) * 100,
        expectancy: expectancyR,
        targetEquityValue: targetEquity,
        avgMaxDrawdown: totalMaxDrawdowns / numPaths,
        avgMaxWinStreak: Math.round(totalMaxWinStreak / numPaths),
        avgMaxLossStreak: Math.round(totalMaxLossStreak / numPaths),
        extremeMaxWinStreak: absoluteMaxWinStreak,
        extremeMaxLossStreak: absoluteMaxLossStreak
      });

      setIsSimulating(false);
    }, 150); 
  };

  useEffect(() => {
    runSimulation();
  }, []);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: Number(value) }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 font-sans" dir="rtl">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <Layers className="text-blue-500" />
            محاكي مونت كارلو الكمّي (Stochastic Quant)
          </h1>
          <p className="text-slate-400 mt-1 text-sm">يقوم باختبار الاستراتيجية مئات المرات لإنشاء نطاق ثقة إحصائي</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <button 
            onClick={downloadCSV}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all border border-slate-700"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            تصدير البيانات
          </button>
          <button 
            onClick={runSimulation}
            disabled={isSimulating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
            {isSimulating ? 'جاري المعالجة...' : 'بدء المحاكاة'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Inputs Panel */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              محددات الاستراتيجية
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">رأس المال (Deposit)</label>
                <div className="relative">
                  <DollarSign className="absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input type="number" name="initialDeposit" value={inputs.initialDeposit} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pr-9 pl-3 text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">نسبة النجاح (Win Rate %)</label>
                <input type="number" name="winRate" value={inputs.winRate} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
                <input type="range" name="winRate" min="1" max="99" value={inputs.winRate} onChange={handleInputChange} className="w-full mt-2 accent-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">المخاطرة %</label>
                  <input type="number" step="0.1" name="riskPerTrade" value={inputs.riskPerTrade} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">العائد %</label>
                  <input type="number" step="0.1" name="rewardPerTrade" value={inputs.rewardPerTrade} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2 mt-2">إدارة العقود (Position Sizing)</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-lg">
                  <button 
                    onClick={() => setInputs(prev => ({...prev, positionSizing: 'fixed'}))}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${inputs.positionSizing === 'fixed' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    مخاطرة ثابتة
                  </button>
                  <button 
                    onClick={() => setInputs(prev => ({...prev, positionSizing: 'compounding'}))}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${inputs.positionSizing === 'compounding' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    تراكمي (مضاعف)
                  </button>
                </div>
              </div>

              <hr className="border-slate-800 my-4" />

              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700/50">
                <label className="block text-sm text-emerald-400 mb-1 font-medium flex items-center gap-1">
                  <Crosshair className="w-4 h-4" /> الهدف بـ (R)
                </label>
                <div className="relative">
                  <span className="absolute right-3 top-2.5 text-slate-500 font-bold">R</span>
                  <input type="number" name="targetR" value={inputs.targetR} onChange={handleInputChange} className="w-full bg-slate-800 border border-emerald-900/50 rounded-lg py-2 pr-9 pl-3 text-white focus:outline-none focus:border-emerald-500 text-left" dir="ltr" />
                </div>
              </div>

              <hr className="border-slate-800 my-4" />

              <div>
                <label className="block text-sm text-purple-400 mb-1 font-medium">عدد المسارات (عوالم موازية)</label>
                <input type="number" name="numPaths" value={inputs.numPaths} onChange={handleInputChange} className="w-full bg-slate-800 border border-purple-900/50 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-purple-500 text-left" dir="ltr" />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">حد الخسارة الفادحة (Ruin Level %)</label>
                <input type="number" name="ruinDrawdown" value={inputs.ruinDrawdown} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">عدد الصفقات (Trades)</label>
                <input type="number" name="numTrades" value={inputs.numTrades} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts & KPIs */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Main KPIs Row */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <p className="text-sm text-slate-400 mb-1 flex items-center gap-1">
                  <Calculator className="w-4 h-4" /> التوقع الرياضي
                </p>
                <p className={`text-2xl font-bold ${metrics.expectancy > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {metrics.expectancy > 0 ? '+' : ''}{metrics.expectancy.toFixed(2)} R
                </p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl border-t-2 border-t-emerald-500">
                <p className="text-sm text-slate-400 mb-1">احتمال الهدف ({inputs.targetR}R)</p>
                <p className="text-2xl font-bold text-emerald-400">{metrics.targetHitProbability.toFixed(1)}%</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl border-t-2 border-t-rose-500">
                <p className="text-sm text-slate-400 mb-1">احتمالية الإفلاس</p>
                <p className="text-2xl font-bold text-rose-400">{metrics.ruinProbability.toFixed(1)}%</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <p className="text-sm text-slate-400 mb-1">متوسط أقصى تراجع</p>
                <p className="text-2xl font-bold text-orange-400">{metrics.avgMaxDrawdown.toFixed(2)}%</p>
              </div>
            </div>
          )}

          {/* Streaks KPIs */}
          {metrics && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1 bg-emerald-500"></div>
                <p className="text-sm text-slate-400 mb-1 flex items-center gap-1"><Flame className="w-4 h-4 text-emerald-500" /> متوسط سلسلة الأرباح</p>
                <p className="text-2xl font-bold text-emerald-400">{metrics.avgMaxWinStreak}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1 bg-teal-500"></div>
                <p className="text-sm text-slate-400 mb-1">أطول سلسلة أرباح (الحظ)</p>
                <p className="text-2xl font-bold text-teal-400">{metrics.extremeMaxWinStreak}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1 bg-orange-500"></div>
                <p className="text-sm text-slate-400 mb-1 flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-orange-500" /> متوسط سلسلة الخسائر</p>
                <p className="text-2xl font-bold text-orange-400">{metrics.avgMaxLossStreak}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl relative overflow-hidden">
                <div className="absolute right-0 top-0 h-full w-1 bg-rose-500"></div>
                <p className="text-sm text-slate-400 mb-1">أسوأ خسائر متتالية</p>
                <p className="text-2xl font-bold text-rose-500">{metrics.extremeMaxLossStreak}</p>
              </div>
            </div>
          )}

          {/* Probability Cone Chart */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                مخروط الاحتمالات (Probability Cone)
              </h2>
              {metrics && (
                <div className="text-xs flex gap-4 text-slate-400">
                  <span>المتوسط: <span className="text-blue-400 font-bold">{formatCurrency(metrics.medianFinal)}</span></span>
                  <span>أفضل 5%: <span className="text-emerald-400 font-bold">{formatCurrency(metrics.bestFinal)}</span></span>
                  <span>أسوأ 5%: <span className="text-rose-400 font-bold">{formatCurrency(metrics.worstFinal)}</span></span>
                </div>
              )}
            </div>
            
            <div className="h-80 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={simulationData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="trade" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} minTickGap={30} />
                  <YAxis domain={['auto', 'auto']} stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `$${value.toLocaleString()}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                    formatter={(value, name) => {
                      if(name === 'median') return [formatCurrency(value), "المسار المتوسط"];
                      if(name === 'confidenceBand') return [`${formatCurrency(value[0])} - ${formatCurrency(value[1])}`, "نطاق الثقة 90%"];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `صفقة: ${label}`}
                  />
                  <ReferenceLine y={inputs.initialDeposit} stroke="#475569" strokeDasharray="3 3" />
                  <Area type="monotone" dataKey="confidenceBand" stroke="none" fill="#3b82f6" fillOpacity={0.15} isAnimationActive={false} />
                  <Line type="monotone" dataKey="median" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} />
                  <ReferenceLine y={metrics?.targetEquityValue} stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'top', value: `الهدف (${inputs.targetR}R)`, fill: '#10b981', fontSize: 12 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Drawdown Curve Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-400" /> منحنى التراجع (Drawdown)
              </h2>
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={simulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="trade" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} minTickGap={30} />
                    <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `${value}%`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                      formatter={(value, name) => {
                        if(name === 'medianDD') return [`${value.toFixed(2)}%`, "متوسط التراجع"];
                        if(name === 'worstDD') return [`${value.toFixed(2)}%`, "أسوأ تراجع"];
                        return [value, name];
                      }}
                      labelFormatter={(label) => `صفقة: ${label}`}
                    />
                    <ReferenceLine y={0} stroke="#475569" />
                    <Area type="monotone" dataKey="medianDD" stroke="#f97316" fill="#f97316" fillOpacity={0.2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="worstDD" stroke="#ef4444" strokeWidth={1} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Distribution Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-400" /> توزيع الرصيد (Distribution)
              </h2>
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="rangeStart" stroke="#64748b" tickFormatter={(v) => `$${Math.round(v/1000)}k`} tick={{fill: '#64748b', fontSize: 10}} />
                    <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#1e293b'}}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                      formatter={(value) => [value, "المسارات"]}
                      labelFormatter={(_, payload) => payload.length > 0 ? payload[0].payload.label : ''}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default App;