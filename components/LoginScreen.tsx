
import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
         // User exists in Auth but not in Firestore (No Role Assigned)
         // We do NOT auto-create anymore based on requirements.
         // The App component will handle the "No Role" state, 
         // but here we can optionally show a warning or just let the App.tsx handle the UI
         console.warn("User logged in but has no profile in Firestore");
      } else {
          const timestamp = new Date().toISOString();
          await updateDoc(userRef, { lastLogin: timestamp });
      }

    } catch (err: any) {
      console.error(err);
      setError('লগইন ব্যর্থ হয়েছে। ইমেইল বা পাসওয়ার্ড চেক করুন।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden font-sans">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
            <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-violet-500/20 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute top-[20%] right-[0%] w-[40%] h-[40%] bg-indigo-500/20 rounded-full blur-[100px] animate-pulse delay-700"></div>
            <div className="absolute -bottom-[10%] -left-[0%] w-[60%] h-[60%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-1000"></div>
        </div>

        <div className="w-full max-w-sm bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-white p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500"></div>

            <div className="flex flex-col items-center mb-8 pt-4">
                <div className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg shadow-violet-500/30 mb-6 rotate-3 transform hover:rotate-6 transition-transform duration-300">
                    <ShieldCheck size={40} className="text-white" strokeWidth={1.5} />
                </div>
                <h1 className="text-3xl font-black text-slate-800 tracking-tight">PTT MANAGER</h1>
                <p className="text-slate-500 text-sm font-medium mt-2">Sign in to your account</p>
            </div>
            
            <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-3">Email Address</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-violet-600 transition-colors" strokeWidth={1.5} />
                        </div>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="block w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all font-semibold text-sm"
                            placeholder="user@example.com"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-3">Password</label>
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-violet-600 transition-colors" strokeWidth={1.5} />
                        </div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="block w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all font-semibold text-sm"
                            placeholder="••••••••"
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center gap-3 animate-pulse">
                        <AlertCircle className="text-rose-500 shrink-0" size={18} />
                        <p className="text-rose-600 text-xs font-bold leading-relaxed">{error}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full relative group overflow-hidden bg-slate-900 text-white p-4 rounded-2xl font-bold shadow-xl shadow-slate-200 hover:shadow-2xl hover:shadow-slate-300 transition-all duration-300 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-violet-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    <span className="relative flex items-center justify-center gap-2 uppercase tracking-wide text-sm">
                        {loading ? 'Authenticating...' : <>Login <ArrowRight size={18} /></>}
                    </span>
                </button>
            </form>

            <div className="mt-8 flex flex-col items-center gap-3 opacity-60">
                 <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <Sparkles size={12} className="text-violet-500"/>
                    <span>Secure Access System</span>
                 </div>
            </div>
        </div>
    </div>
  );
};

export default LoginScreen;
