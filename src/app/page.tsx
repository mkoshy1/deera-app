"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/app/firebase"; 
import { signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";

export default function Login() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // إذا كان المستخدم يملك جلسة نشطة بالفعل، يتم توجيهه تلقائياً دون الحاجة لإعادة تسجيل الدخول
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.push("/discover");
      }
    });
    return () => unsub();
  }, [router]);

  const handleLogin = async () => {
    if (!email || !password) {
      alert("يرجى إدخال البريد الإلكتروني وكلمة المرور أولاً 🔐");
      return;
    }

    setLoading(true);
    try {
      // تسجيل الدخول الحقيقي وفتح الجلسة في فايربيس
      await signInWithEmailAndPassword(auth, email.trim(), password);
      
      // التوجيه الفوري لصفحة الاستكشاف عند النجاح
      router.push("/discover"); 
    } catch (error: any) {
      console.error("خطأ في تسجيل الدخول:", error);
      if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
        alert("البريد الإلكتروني أو كلمة المرور غير صحيحة ❌");
      } else {
        alert("حدث خطأ أثناء تسجيل الدخول، يرجى المحاولة لاحقاً.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-900 via-purple-900 to-black flex flex-col items-center justify-center p-6" dir="rtl">
      
      <div className="mb-10 text-center">
        <div className="w-20 h-20 bg-linear-to-tr from-pink-500 to-indigo-500 rounded-full flex items-center justify-center text-4xl shadow-2xl shadow-pink-500/30 mx-auto mb-4 border-2 border-white/20">
          🔥
        </div>
        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-pink-400 to-indigo-400 tracking-wider">
          ديرة
        </h1>
        <p className="text-gray-400 text-sm mt-2">مكانك للتعارف الآمن</p>
      </div>

      <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-4xl p-8 shadow-2xl text-white">
        <h2 className="text-2xl font-bold mb-6 text-center">تسجيل الدخول</h2>

        <div className="space-y-4">
          <input 
            value={email}
            onChange={(e) => setEmail(e.target.value)} 
            type="email" 
            placeholder="البريد الإلكتروني" 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none text-left focus:border-indigo-500 transition" 
            dir="ltr" 
          />
          
          <input 
            value={password}
            onChange={(e) => setPassword(e.target.value)} 
            type="password" 
            placeholder="كلمة المرور" 
            className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-indigo-500 transition" 
          />
          
          <button 
            onClick={handleLogin} 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold transition shadow-lg shadow-indigo-900/50 mt-4"
          >
            {loading ? "جاري التحقق... ⏳" : "دخول 🚀"}
          </button>
        </div>

        <div className="mt-8 text-center border-t border-white/10 pt-6">
          <p className="text-sm text-gray-400 mb-3">ليس لديك حساب؟</p>
          <button 
            onClick={() => router.push("/register")} 
            className="w-full bg-white/5 hover:bg-white/10 text-pink-400 border border-white/10 py-3 rounded-2xl font-bold transition"
          >
            إنشاء حساب جديد ✨
          </button>
        </div>
      </div>

    </div>
  );
}