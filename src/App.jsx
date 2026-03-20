import React, { useState, useEffect } from 'react';
import { 
  ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ReferenceLine,
  BarChart, Bar
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, DollarSign, Percent, 
  RotateCcw, Target, Layers, Download, Calculator, Crosshair,
  Flame, AlertTriangle, BarChart3, Award, Zap, Scale, Calendar
} from 'lucide-react';


const App = () => {
  // 1. حالة الإدخالات
  const [inputs, setInputs] = useState({
    initialDeposit: 10000,
    winRate: 17.1,
    riskPerTrade: 1, 
    rewardPerTrade: 10.66, 
    numTrades: 321,
    numPaths: 500, 
    ruinDrawdown: 50, 
    targetR: 300, 
    positionSizing: 'fixed' 
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
    link.setAttribute("download", "MonteCarlo_Elite_Report.csv");
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
      const expectancyValue = initialDeposit * riskRatio * expectancyR;


      let ruinedPathsCount = 0;
      let targetHitCount = 0;
      
      let totalMaxDrawdownsPct = 0;
      let totalMaxDrawdownsVal = 0;
      let totalMaxWinStreak = 0;
      let totalMaxLossStreak = 0;
      let absoluteMaxLossStreak = 0;
      let absoluteMaxWinStreak = 0;
      
      let totalProfitFactor = 0;
      let totalSharpe = 0;
      let totalSortino = 0;
      let totalWins = 0;
      let totalLosses = 0;


      let finalEquities = [];
      let stepEquities = Array.from({ length: numTrades + 1 }, () => []);
      let stepDrawdowns = Array.from({ length: numTrades + 1 }, () => []);


      for (let p = 0; p < numPaths; p++) {
        let currentEquity = initialDeposit;
        let isRuined = false;
        let hasHitTarget = false;
        let peakEquity = currentEquity;
        let maxDrawdownPctForPath = 0;
        let maxDrawdownValForPath = 0;
        
        let currentWinStreak = 0;
        let currentLossStreak = 0;
        let pathMaxWinStreak = 0;
        let pathMaxLossStreak = 0;
        
        let pathGrossProfit = 0;
        let pathGrossLoss = 0;
        let pathWins = 0;
        let pathLosses = 0;
        let pathReturns = [];
        
        stepEquities[0].push(currentEquity);
        stepDrawdowns[0].push(0);


        for (let t = 1; t <= numTrades; t++) {
          if (currentEquity <= 0) {
            currentEquity = 0;
            currentLossStreak++;
            currentWinStreak = 0;
            pathReturns.push(0);
            if(currentLossStreak > pathMaxLossStreak) pathMaxLossStreak = currentLossStreak;
          } else {
            const isWin = Math.random() < winProb;
            
            const baseAmountForRisk = inputs.positionSizing === 'compounding' ? currentEquity : initialDeposit;
            const tradeRiskAmount = baseAmountForRisk * riskRatio;
            const tradeRewardAmount = baseAmountForRisk * rewardRatio;


            if (isWin) {
              pathReturns.push(tradeRewardAmount / currentEquity);
              currentEquity += tradeRewardAmount;
              pathGrossProfit += tradeRewardAmount;
              pathWins++;
              currentWinStreak++;
              currentLossStreak = 0;
              if (currentWinStreak > pathMaxWinStreak) pathMaxWinStreak = currentWinStreak;
            } else {
              pathReturns.push(-tradeRiskAmount / currentEquity);
              currentEquity -= tradeRiskAmount;
              pathGrossLoss += tradeRiskAmount;
              pathLosses++;
              currentLossStreak++;
              currentWinStreak = 0;
              if (currentLossStreak > pathMaxLossStreak) pathMaxLossStreak = currentLossStreak;
            }
          }


          if (currentEquity > peakEquity) peakEquity = currentEquity;
          
          const currentDDPct = peakEquity > 0 ? ((peakEquity - currentEquity) / peakEquity) * 100 : 0;
          const currentDDVal = peakEquity - currentEquity;
          
          if (currentDDPct > maxDrawdownPctForPath) maxDrawdownPctForPath = currentDDPct;
          if (currentDDVal > maxDrawdownValForPath) maxDrawdownValForPath = currentDDVal;


          if (currentEquity <= ruinLevel && !isRuined) isRuined = true;
          if (currentEquity >= targetEquity && !hasHitTarget) hasHitTarget = true;


          stepEquities[t].push(currentEquity);
          stepDrawdowns[t].push(currentDDPct);
        }


        let pf = pathGrossLoss > 0 ? pathGrossProfit / pathGrossLoss : pathGrossProfit;
        totalProfitFactor += pf;
        totalWins += pathWins;
        totalLosses += pathLosses;


        let meanRet = pathReturns.reduce((a,b)=>a+b,0) / numTrades;
        let stdRet = Math.sqrt(pathReturns.reduce((a,b)=>a+Math.pow(b-meanRet,2),0) / numTrades) || 1;
        let sharpe = (meanRet / stdRet) * Math.sqrt(numTrades);
        totalSharpe += sharpe;


        let negReturns = pathReturns.filter(r => r < 0);
        let meanNegRet = negReturns.length > 0 ? negReturns.reduce((a,b)=>a+b,0) / negReturns.length : 0;
        let stdDown = Math.sqrt(negReturns.reduce((a,b)=>a+Math.pow(b-meanNegRet,2),0) / (negReturns.length || 1)) || 1;
        let sortino = negReturns.length > 0 ? (meanRet / stdDown) * Math.sqrt(numTrades) : sharpe;
        totalSortino += sortino;


        if (isRuined) ruinedPathsCount++;
        if (hasHitTarget) targetHitCount++;
        
        totalMaxDrawdownsPct += maxDrawdownPctForPath;
        totalMaxDrawdownsVal += maxDrawdownValForPath;
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
          // ✅ إصلاح: حذف confidenceBand المصفوفي واستخدام p5/p95 مباشرةً في Area
          medianDD: -dd50, 
          worstDD: -dd95
        });
      }


      setSimulationData(chartData);
      finalEquities.sort((a, b) => a - b);


      const minEq = finalEquities[0];
      const maxEq = finalEquities[numPaths - 1];
      const bucketCount = 15;
      const bucketSize = (maxEq - minEq) / bucketCount || 1; // ✅ إصلاح: منع القسمة على صفر
      
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


      const avgPF = totalProfitFactor / numPaths;
      const avgSharpe = totalSharpe / numPaths;
      const avgSortino = totalSortino / numPaths;
      const avgWinRate = (totalWins / (totalWins + totalLosses)) * 100;
      const medianFinal = finalEquities[Math.floor(numPaths * 0.50)];
      const medianNetProfit = medianFinal - initialDeposit;
      const avgDDVal = totalMaxDrawdownsVal / numPaths;
      const avgDDPct = totalMaxDrawdownsPct / numPaths;
      
      let score = (avgPF * 15) + (expectancyR * 20) + (avgWinRate * 0.5) - (avgDDPct * 0.5) + (avgSortino * 2);
      let smartScore = Math.min(100, Math.max(0, score));


      setMetrics({
        medianFinal: medianFinal,
        medianNetProfit: medianNetProfit,
        worstFinal: finalEquities[0],
        bestFinal: finalEquities[numPaths - 1],
        ruinProbability: (ruinedPathsCount / numPaths) * 100,
        targetHitProbability: (targetHitCount / numPaths) * 100,
        
        expectancyR: expectancyR,
        expectancyValue: expectancyValue,
        profitFactor: avgPF,
        sharpe: avgSharpe,
        sortino: avgSortino,
        simulatedWinRate: avgWinRate,
        smartScore: smartScore,


        avgMaxDrawdownPct: avgDDPct,
        avgMaxDrawdownVal: avgDDVal,
        targetEquityValue: targetEquity,
        avgMaxWinStreak: Math.round(totalMaxWinStreak / numPaths),
        avgMaxLossStreak: Math.round(totalMaxLossStreak / numPaths),
        extremeMaxWinStreak: absoluteMaxWinStreak,
        extremeMaxLossStreak: absoluteMaxLossStreak
      });


      setIsSimulating(false);
    }, 150); 
  };


  // ✅ إصلاح: إضافة [] لمنع الـ infinite loop
  useEffect(() => {
    runSimulation();
  }, []);


  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);


  // ✅ إصلاح: التعامل مع positionSizing كنص وليس رقم
  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setInputs(prev => ({ ...prev, [name]: type === 'text' || name === 'positionSizing' ? value : Number(value) }));
  };


  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-6 font-sans selection:bg-blue-500/30" dir="rtl">
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <Layers className="text-blue-500" />
            محاكي مونت كارلو الكمّي (Stochastic Quant)
          </h1>
          <p className="text-slate-400 mt-1 text-sm">أداة متقدمة لتقييم الأنظمة الخوارزمية واستخراج مقاييس الأداء للصناديق</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <button 
            onClick={downloadCSV}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all border border-slate-700 shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            تصدير البيانات
          </button>
          <button 
            onClick={runSimulation}
            disabled={isSimulating}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
            {isSimulating ? 'جاري المعالجة...' : 'تحديث التقرير'}
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
                  <input type="number" name="initialDeposit" value={inputs.initialDeposit} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 pr-9 pl-3 text-white focus:outline-none focus:border-blue-500 transition-colors" />
                </div>
              </div>


              <div>
                <label className="block text-sm text-slate-400 mb-1">نسبة النجاح (Win Rate %)</label>
                <div className="flex gap-2 items-center">
                   <input type="number" step="0.1" name="winRate" value={inputs.winRate} onChange={handleInputChange} className="w-24 bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
                   <input type="range" name="winRate" min="1" max="99" step="0.1" value={inputs.winRate} onChange={handleInputChange} className="w-full accent-blue-500" />
                </div>
              </div>


              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">المخاطرة %</label>
                  <input type="number" step="0.1" name="riskPerTrade" value={inputs.riskPerTrade} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">العائد % (Reward)</label>
                  <input type="number" step="0.1" name="rewardPerTrade" value={inputs.rewardPerTrade} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
                </div>
              </div>


              <div>
                <label className="block text-sm text-slate-400 mb-2 mt-2">إدارة العقود (Position Sizing)</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-lg">
                  <button 
                    onClick={() => setInputs(prev => ({...prev, positionSizing: 'fixed'}))}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${inputs.positionSizing === 'fixed' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                  >
                    مخاطرة ثابتة
                  </button>
                  <button 
                    onClick={() => setInputs(prev => ({...prev, positionSizing: 'compounding'}))}
                    className={`py-1.5 text-xs font-medium rounded-md transition-all ${inputs.positionSizing === 'compounding' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
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
                <label className="block text-sm text-slate-400 mb-1">حد الإفلاس (Ruin Level %)</label>
                <input type="number" name="ruinDrawdown" value={inputs.ruinDrawdown} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
              </div>
              
              <div>
                <label className="block text-sm text-slate-400 mb-1">عدد الصفقات (Trades)</label>
                <input type="number" name="numTrades" value={inputs.numTrades} onChange={handleInputChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-blue-500 text-left" dir="ltr" />
              </div>
            </div>
          </div>
        </div>


        {/* Charts & Reports */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* 🌟 ELITE REPORT PANEL 🌟 */}
          {metrics && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden relative">
              <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-purple-500 to-emerald-500"></div>
              
              <div className="p-5 md:p-6">
                <div className="flex justify-between items-start mb-6 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-xl md:text-2xl font-black text-white tracking-wider flex items-center gap-2">
                      <Award className="w-6 h-6 text-yellow-400" />
                      ELITE QUANT REPORT
                    </h2>
                    <p className="text-slate-400 text-sm mt-1 font-mono">
                       SIMULATION METRICS | BASED ON {inputs.numPaths} STOCHASTIC PATHS
                    </p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <div className="inline-flex items-center gap-1.5 bg-slate-800 px-3 py-1 rounded-full text-xs text-slate-300 font-mono">
                      <Activity className="w-3.5 h-3.5 text-blue-400" />
                      M.CARLO V2.0
                    </div>
                  </div>
                </div>


                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 font-mono text-sm">
                  
                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><TrendingUp className="w-4 h-4 text-emerald-500" /> Net Profit</p>
                    <p className={`text-xl font-bold ${metrics.medianNetProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {metrics.medianNetProfit > 0 ? '+' : ''}{formatCurrency(metrics.medianNetProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><Scale className="w-4 h-4 text-blue-400" /> Profit Factor</p>
                    <p className="text-xl font-bold text-white">{metrics.profitFactor.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><Percent className="w-4 h-4 text-purple-400" /> Win Rate</p>
                    <p className="text-xl font-bold text-white">{metrics.simulatedWinRate.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><Layers className="w-4 h-4 text-slate-400" /> Trades</p>
                    <p className="text-xl font-bold text-white">{inputs.numTrades}</p>
                  </div>


                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><TrendingDown className="w-4 h-4 text-rose-500" /> Max DD</p>
                    <p className="text-xl font-bold text-rose-400">
                      -{formatCurrency(metrics.avgMaxDrawdownVal)} <span className="text-sm">({metrics.avgMaxDrawdownPct.toFixed(2)}%)</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><Activity className="w-4 h-4 text-blue-500" /> Sharpe Ratio</p>
                    <p className="text-xl font-bold text-blue-400">{metrics.sharpe.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><Zap className="w-4 h-4 text-orange-400" /> Sortino Ratio</p>
                    <p className="text-xl font-bold text-orange-400">{metrics.sortino.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><Target className="w-4 h-4 text-emerald-400" /> Expectancy</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {formatCurrency(metrics.expectancyValue)} <span className="text-sm">({metrics.expectancyR.toFixed(2)}R)</span>
                    </p>
                  </div>


                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><Flame className="w-4 h-4 text-emerald-500" /> Con. Wins</p>
                    <p className="text-lg font-bold text-emerald-500">{metrics.avgMaxWinStreak} <span className="text-xs text-slate-500">(Max: {metrics.extremeMaxWinStreak})</span></p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><AlertTriangle className="w-4 h-4 text-rose-500" /> Con. Losses</p>
                    <p className="text-lg font-bold text-rose-500">{metrics.avgMaxLossStreak} <span className="text-xs text-slate-500">(Max: {metrics.extremeMaxLossStreak})</span></p>
                  </div>
                  <div>
                    <p className="text-slate-500 flex items-center gap-1.5 mb-1"><Crosshair className="w-4 h-4 text-teal-400" /> R:R Ratio</p>
                    <p className="text-xl font-bold text-teal-400">1 : {(inputs.rewardPerTrade / inputs.riskPerTrade).toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-800/50 p-2 -m-2 rounded-lg border border-slate-700/50">
                    <p className="text-slate-400 flex items-center gap-1.5 mb-1 text-xs uppercase"><Award className="w-3.5 h-3.5 text-yellow-500" /> Smart Score</p>
                    <div className="flex items-end gap-2">
                       <p className={`text-2xl font-black ${metrics.smartScore > 60 ? 'text-yellow-400' : (metrics.smartScore > 40 ? 'text-blue-400' : 'text-rose-400')}`}>
                         {metrics.smartScore.toFixed(1)}
                       </p>
                       <span className="text-sm text-slate-500 mb-1">/ 100</span>
                    </div>
                  </div>


                </div>
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
                <div className="text-xs flex gap-4 text-slate-400 font-mono">
                  <span>MED: <span className="text-blue-400 font-bold">{formatCurrency(metrics.medianFinal)}</span></span>
                  <span>TOP 5%: <span className="text-emerald-400 font-bold">{formatCurrency(metrics.bestFinal)}</span></span>
                  <span>BOT 5%: <span className="text-rose-400 font-bold">{formatCurrency(metrics.worstFinal)}</span></span>
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
                      if(name === 'p5') return [formatCurrency(value), "أسوأ 5%"];
                      if(name === 'p95') return [formatCurrency(value), "أفضل 5%"];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Trade: ${label}`}
                  />
                  <ReferenceLine y={inputs.initialDeposit} stroke="#475569" strokeDasharray="3 3" />
                  {/* ✅ إصلاح: استبدال Area بـ dataKey مصفوفي بـ Area مكدسة صحيحة */}
                  <Area type="monotone" dataKey="p5" stroke="none" fill="#3b82f6" fillOpacity={0} isAnimationActive={false} legendType="none" />
                  <Area type="monotone" dataKey="p95" stroke="none" fill="#3b82f6" fillOpacity={0.15} isAnimationActive={false} legendType="none" />
                  <Line type="monotone" dataKey="median" stroke="#3b82f6" strokeWidth={3} dot={false} isAnimationActive={false} />
                  {metrics && (
                    <ReferenceLine y={metrics.targetEquityValue} stroke="#10b981" strokeDasharray="5 5" strokeWidth={2} label={{ position: 'top', value: `TARGET (${inputs.targetR}R)`, fill: '#10b981', fontSize: 12 }} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>


          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Drawdown Curve Chart */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                   <Activity className="w-5 h-5 text-orange-400" /> منحنى التراجع (Drawdown)
                 </h2>
                 {metrics && (
                   <div className="text-xs text-slate-400 font-mono">
                      Ruin Risk: <span className="text-rose-400 font-bold">{metrics.ruinProbability.toFixed(1)}%</span>
                   </div>
                 )}
              </div>
              
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={simulationData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="trade" stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} minTickGap={30} />
                    <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} tickFormatter={(value) => `${value}%`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                      formatter={(value, name) => {
                        if(name === 'medianDD') return [`${value.toFixed(2)}%`, "Avg Drawdown"];
                        if(name === 'worstDD') return [`${value.toFixed(2)}%`, "Worst Drawdown"];
                        return [value, name];
                      }}
                      labelFormatter={(label) => `Trade: ${label}`}
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
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                   <BarChart3 className="w-5 h-5 text-purple-400" /> توزيع الرصيد (Distribution)
                 </h2>
                 {metrics && (
                   <div className="text-xs text-slate-400 font-mono">
                      Target Hit: <span className="text-emerald-400 font-bold">{metrics.targetHitProbability.toFixed(1)}%</span>
                   </div>
                 )}
              </div>


              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={distributionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="rangeStart" stroke="#64748b" tickFormatter={(v) => `$${Math.round(v/1000)}k`} tick={{fill: '#64748b', fontSize: 10}} />
                    <YAxis stroke="#64748b" tick={{fill: '#64748b', fontSize: 12}} />
                    <Tooltip 
                      cursor={{fill: '#1e293b'}}
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px', color: '#f8fafc' }}
                      formatter={(value) => [value, "Paths"]}
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
