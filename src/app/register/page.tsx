"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/app/firebase"; 
import { doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";

export default function Register() {
  const router = useRouter();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isRegistering, setIsRegistering] = useState(false);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file)); 
    }
  };

  const handleRegister = async () => {
    // 1. التحقق من تعبئة كافة الحقول وجودة الصورة
    if (!email || !password || !name || !phone || !age || !gender || !imageFile) {
      alert("حبيبي، يرجى تعبئة كل الحقول وإضافة صورتك الشخصية أولاً! 📷");
      return;
    }

    // 2. التحقق الصارم من أن رقم الهاتف عراقي حصراً
    const cleanPhone = phone.trim().replace(/\s+/g, ''); // مسح الفراغات
    // الفحص يضمن أن الرقم يبدأ بـ 077 أو 078 أو 079 أو 075 ومكون من 11 رقم، أو يبدأ بـ 7 ومكون من 10 أرقام
    const iraqiPhoneRegex = /^(07[5789]\d{8}|7[5789]\d{8})$/;
    
    if (!iraqiPhoneRegex.test(cleanPhone)) {
      alert("عذراً! يجب إدخال رقم هاتف عراقي صحيح ومقبول (زين، آسيا سيل، كورك) 🇮🇶");
      return;
    }

    // تنسيق موحد للرقم قبل الحفظ في الفايربيس ليصبح بالصيغة الدولية الدولية المقروءة
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+964" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("+964")) {
      formattedPhone = "+964" + formattedPhone;
    }

    setIsRegistering(true); 
    try {
      // 3. إنشاء الحساب في فايربيس بالبريد والباسوورد
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user; 

      let photoURL = "";

      // 4. رفع الصورة إلى ImgBB بصمت
      if (imageFile) {
        const formData = new FormData();
        formData.append("image", imageFile);
        
        const imgbbAPIKey = "c2540ad59fcbc5191a0907ea1129816d"; 
        
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbAPIKey}`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.success) {
          photoURL = data.data.display_url;
        }
      }

      // 5. حفظ البيانات الكاملة في Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        phone: formattedPhone, // الرقم العراقي الموثق دولياً
        age: age,
        gender: gender,
        photoURL: photoURL, 
        role: "user", 
        supportPoints: 0,
        createdAt: new Date()
      });

      alert("تم إنشاء حسابك بنجاح! أهلاً بك في ديرة 🎉");
      router.push("/discover"); 

    } catch (error: any) {
      console.error("خطأ أثناء التسجيل:", error);
      if (error.code === "auth/email-already-in-use") {
        alert("هذا البريد الإلكتروني مستخدم بالفعل في حساب آخر!");
      } else {
        alert("حدث خطأ أثناء إنشاء الحساب، يرجى المحاولة مجدداً.");
      }
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-indigo-900 via-purple-900 to-black flex items-center justify-center p-6" dir="rtl">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-4xl p-8 shadow-2xl text-white">
        
        <div className="flex items-center justify-center relative mb-6">
          <button 
            onClick={() => router.push("/")} 
            className="absolute right-0 w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-xl hover:bg-white/20 transition cursor-pointer"
            title="رجوع"
          >
            ➡️
          </button>
          <h2 className="text-3xl font-bold">إنشاء حساب</h2>
        </div>

        <div className="space-y-4">
          
          {/* دائرة الصورة الشخصية */}
          <div className="flex flex-col items-center mb-2">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full border-2 border-dashed border-indigo-400 flex flex-col items-center justify-center bg-white/5 cursor-pointer hover:bg-white/10 transition overflow-hidden relative shadow-lg"
            >
              {imagePreview ? (
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">📷</span>
              )}
            </div>
            <p className="text-xs text-indigo-300 mt-2">صورة الحساب (إجبارية)</p>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              onChange={handleImageSelect} 
              className="hidden" 
            />
          </div>

          <input onChange={(e) => setName(e.target.value)} type="text" placeholder="الاسم الكامل" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none" />
          
          <input onChange={(e) => setEmail(e.target.value)} type="email" placeholder="البريد الإلكتروني" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none text-left" dir="ltr" />
          
          <input onChange={(e) => setPhone(e.target.value)} type="tel" placeholder="رقم الهاتف العراقي (مثال: 07701234567)" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none text-right" dir="ltr" />
          
          <div className="grid grid-cols-2 gap-4">
              <input onChange={(e) => setAge(e.target.value)} type="number" placeholder="العمر" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none" />
              <select onChange={(e) => setGender(e.target.value)} className="w-full bg-gray-800 border border-white/10 p-4 rounded-2xl outline-none text-gray-300">
                  <option value="">الجنس</option>
                  <option value="ذكر">ذكر</option>
                  <option value="أنثى">أنثى</option>
              </select>
          </div>
          
          <input onChange={(e) => setPassword(e.target.value)} type="password" placeholder="كلمة المرور" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none" />
          
          <button 
            onClick={handleRegister} 
            disabled={isRegistering}
            className={`w-full py-4 rounded-2xl font-bold transition shadow-lg ${
              isRegistering ? "bg-gray-600 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50 mt-2"
            }`}
          >
            {isRegistering ? "جاري إنشاء الحساب ورفع الصورة... ⏳" : "تسجيل حساب جديد"}
          </button>
        </div>
      </div>
    </div>
  );
}