import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '@/services/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { LogIn, ShieldCheck, Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
      }
    } catch (error: any) {
      console.error("Auth Error", error);
      let message = 'Error en la autenticación';
      if (error.code === 'auth/user-not-found') message = 'Usuario no encontrado';
      if (error.code === 'auth/wrong-password') message = 'Contraseña incorrecta';
      if (error.code === 'auth/email-already-in-use') message = 'El correo ya está registrado';
      
      window.dispatchEvent(new CustomEvent('app-notification', { 
        detail: { message, type: 'error' } 
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div className="absolute inset-0 z-0">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent"></div>
          <img 
            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&q=80&w=2000" 
            alt="bg" 
            className="w-full h-full object-cover opacity-20 mix-blend-overlay grayscale" 
          />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white p-10 rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.3)] max-w-md w-full relative z-10 border border-slate-100"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <motion.div 
            whileHover={{ rotate: 15 }}
            className="bg-slate-900 p-5 rounded-2xl mb-5 shadow-2xl shadow-slate-300"
          >
            <ShieldCheck size={40} className="text-emerald-400" />
          </motion.div>
          <h1 className="text-4xl font-black text-slate-800 tracking-tighter uppercase italic">MADECAS AI</h1>
          <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2">Plataforma de Control Comercial</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    required
                    type="text"
                    placeholder="Nombre Completo"
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-sm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-2">
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                required
                type="email"
                placeholder="Correo Electrónico"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                required
                type="password"
                placeholder="Contraseña"
                className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all active:scale-[0.98] shadow-2xl shadow-slate-200 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <>
                {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-slate-100 flex flex-col items-center gap-4">
          <button 
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-black text-slate-400 hover:text-emerald-500 uppercase tracking-widest transition-colors"
          >
            {isLogin ? '¿No tienes cuenta? Registrate' : '¿Ya tienes cuenta? Ingresa'}
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={12} className="text-emerald-500" />
            <p className="text-[10px] text-slate-300 uppercase font-black tracking-widest">Safe Cloud Access</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
