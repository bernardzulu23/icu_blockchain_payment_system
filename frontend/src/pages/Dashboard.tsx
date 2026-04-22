import { useQuery } from 'react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { paymentService } from '../api/services';

export default function Dashboard() {
  const { data } = useQuery('payments-stats', () =>
    paymentService.list({ limit: 100 }).then((r) => r.data)
  );

  const payments = data?.payments ?? [];
  const pending = payments.filter((p) => p.status === 'pending').length;
  const verified = payments.filter((p) => p.status === 'verified').length;
  const totalAmount = payments.reduce((s, p) => s + p.amount, 0);

  const chartData = [
    { name: 'Pending', count: pending, color: '#06b6d4' },
    { name: 'Verified', count: verified, color: '#f43f5e' },
    { name: 'Rejected', count: payments.filter((p) => p.status === 'rejected').length, color: '#8b5cf6' },
    { name: 'Duplicate', count: payments.filter((p) => p.status === 'duplicate').length, color: '#3b82f6' },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Top Stats Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Progress Gauges */}
        <div className="lg:col-span-5 grid grid-cols-2 gap-8">
          <div className="bg-[#0a0f1e]/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5 flex flex-col items-center justify-center relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent rounded-[2.5rem]" />
            <div className="relative w-32 h-32 mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-white/5" />
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (364 * 31) / 100} className="text-pink-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">31%</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Today Matching</p>
          </div>

          <div className="bg-[#0a0f1e]/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5 flex flex-col items-center justify-center relative group">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent rounded-[2.5rem]" />
            <div className="relative w-32 h-32 mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" className="text-white/5" />
                <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="10" fill="transparent" strokeDasharray={364} strokeDashoffset={364 - (364 * 46) / 100} className="text-purple-500 transition-all duration-1000 ease-out" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">46%</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Weekly Audit</p>
          </div>
        </div>

        {/* Numeric Stats */}
        <div className="lg:col-span-7 bg-[#0a0f1e]/40 backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 relative">
          <div className="flex justify-between items-start mb-10">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-bold mb-1">This Month</p>
              <h3 className="text-3xl font-bold text-white">Overview</h3>
            </div>
            <button className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold transition-all border border-white/5">Check</button>
          </div>
          
          <div className="grid grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="flex items-end gap-3">
                <span className="text-4xl font-bold text-white">78%</span>
                <span className="text-xs text-slate-500 mb-1">Today</span>
              </div>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-bold text-white">31%</span>
                <span className="text-xs text-slate-500 mb-1">This Year</span>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex items-end gap-3">
                <span className="text-4xl font-bold text-white">84%</span>
                <span className="text-xs text-slate-500 mb-1">This Week</span>
              </div>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-bold text-white">61%</span>
                <span className="text-xs text-slate-500 mb-1">Check</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Chart Bar */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-[#0a0f1e]/40 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5">
            <div className="flex items-center justify-between mb-8">
              <span className="text-2xl font-bold text-white">287</span>
              <span className="text-2xl font-bold text-white/40">312</span>
              <span className="text-2xl font-bold text-white/10">176</span>
            </div>
            <div className="flex items-end justify-between h-48 px-2">
              <div className="w-6 bg-gradient-to-t from-cyan-500 to-blue-500 rounded-full h-[60%]" />
              <div className="w-6 bg-gradient-to-t from-orange-500 to-red-500 rounded-full h-[85%]" />
              <div className="w-6 bg-gradient-to-t from-blue-500 to-indigo-500 rounded-full h-[45%]" />
              <div className="w-6 bg-gradient-to-t from-cyan-400 to-cyan-600 rounded-full h-[70%]" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-pink-500/20 to-purple-600/10 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/5">
             <div className="flex items-center justify-between mb-6">
               <h4 className="text-sm font-bold text-white uppercase tracking-wider">Payments</h4>
               <span className="text-xs text-white/50">Many of our products</span>
             </div>
             <div className="h-24 flex items-end gap-1">
               {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                 <div key={i} className="flex-1 bg-white/20 rounded-t-sm" style={{ height: `${h}%` }} />
               ))}
             </div>
          </div>
        </div>

        {/* Center Main Chart */}
        <div className="lg:col-span-8 bg-[#0a0f1e]/40 backdrop-blur-xl rounded-[2.5rem] p-10 border border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-pink-500/5 to-transparent pointer-events-none" />
          <div className="relative h-full flex flex-col">
            <div className="flex items-center justify-between mb-12">
              <h3 className="text-xl font-bold text-white">Transaction Flow</h3>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pink-500" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Success</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Pending</span>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{
                      backgroundColor: 'rgba(10, 15, 30, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '16px',
                      backdropFilter: 'blur(10px)',
                    }}
                  />
                  <Bar dataKey="count" radius={[10, 10, 10, 10]} barSize={40}>
                    {chartData.map((entry, index) => (
                      <circle key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-8">
              <div className="flex gap-12">
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Total</p>
                  <p className="text-xl font-bold text-white">{payments.length}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Verified</p>
                  <p className="text-xl font-bold text-pink-500">{verified}</p>
                </div>
              </div>
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-[#0a0f1e] bg-slate-800 flex items-center justify-center text-[10px] font-bold text-white">
                    U{i}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
