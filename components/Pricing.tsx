import React from 'react';

export default function PricingSection() {
  const handleCheckout = (priceId: string) => {
    window.location.href = `/api/checkout?priceId=${priceId}`;
  };

  return (
    <section className="bg-slate-950 text-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        
        {/* 🚨 High-Priority Emergency Hero Banner */}
        <div className="mb-12 border-2 border-red-600 bg-red-950/40 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-red-900/20 backdrop-blur-md relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-red-600 text-white font-bold text-xs uppercase tracking-widest px-4 py-1 rounded-bl-lg">
            Immediate Dispatch
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-2">
              <span className="inline-block bg-red-500/20 text-red-400 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                Active Breach / Incident Response
              </span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                4-Hour Rapid Emergency Response & Remediation
              </h2>
              <p className="text-slate-300 max-w-2xl text-sm sm:text-base">
                Facing an active breach, ransomware threat, or urgent compliance audit failure? Our rapid response team deploys behavioral threat detection, perimeter isolation, and remediation within 4 hours.
              </p>
            </div>
            <div className="w-full md:w-auto flex flex-col sm:flex-row md:flex-col items-stretch md:items-end gap-3 min-w-[220px]">
              <div className="text-left md:text-right">
                <span className="text-3xl font-bold text-white">$1,499</span>
                <span className="text-slate-400 text-sm"> / emergency event</span>
              </div>
              <button
                onClick={() => handleCheckout('price_1TwgHMD5LVILsj0FdCUQpuWt')}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3 px-6 rounded-xl transition duration-200 shadow-lg shadow-red-600/30 text-center"
              >
                Dispatch Response Team
              </button>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Continuous Security Sentinel Plans
          </h2>
          <p className="mt-3 text-slate-400 max-w-xl mx-auto">
            Proactive threat detection, vulnerability management, and continuous perimeter monitoring.
          </p>
        </div>

        {/* Standard Monthly Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Basic Tier */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <h3 className="text-lg font-bold text-slate-200">Basic Sentinel</h3>
              <p className="text-slate-400 text-sm mt-1">Essential monitoring for small infrastructure.</p>
              <div className="my-6">
                <span className="text-4xl font-extrabold text-white">$49</span>
                <span className="text-slate-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-300 mb-6">
                <li className="flex items-center">✓ Automated Perimeter Scanning</li>
                <li className="flex items-center">✓ Weekly Vulnerability Reports</li>
                <li className="flex items-center">✓ Basic Asset Discovery</li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout('price_basic_monthly')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-xl transition"
            >
              Get Started
            </button>
          </div>

          {/* Standard Tier */}
          <div className="bg-slate-900 border-2 border-blue-500/50 rounded-2xl p-6 flex flex-col justify-between relative hover:border-blue-500 transition shadow-xl shadow-blue-500/10">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Most Popular
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-200">Standard Sentinel</h3>
              <p className="text-slate-400 text-sm mt-1">Full endpoint & network security coverage.</p>
              <div className="my-6">
                <span className="text-4xl font-extrabold text-white">$149</span>
                <span className="text-slate-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-300 mb-6">
                <li className="flex items-center">✓ Continuous Threat Detection</li>
                <li className="flex items-center">✓ Behavioral Isolation</li>
                <li className="flex items-center">✓ Daily Scan Reports & Alerts</li>
                <li className="flex items-center">✓ SIEM & Wazuh Integration</li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout('price_standard_monthly')}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-xl transition"
            >
              Get Started
            </button>
          </div>

          {/* Premium Tier */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between hover:border-slate-700 transition">
            <div>
              <h3 className="text-lg font-bold text-slate-200">Premium Sentinel</h3>
              <p className="text-slate-400 text-sm mt-1">Enterprise-grade compliance & dedicated support.</p>
              <div className="my-6">
                <span className="text-4xl font-extrabold text-white">$299</span>
                <span className="text-slate-400 text-sm">/month</span>
              </div>
              <ul className="space-y-3 text-sm text-slate-300 mb-6">
                <li className="flex items-center">✓ Everything in Standard</li>
                <li className="flex items-center">✓ Priority Incident Escalation</li>
                <li className="flex items-center">✓ Compliance Auditing (HIPAA/SOC2)</li>
                <li className="flex items-center">✓ Custom Automation Scripts</li>
              </ul>
            </div>
            <button
              onClick={() => handleCheckout('price_premium_monthly')}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-2.5 px-4 rounded-xl transition"
            >
              Get Started
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
