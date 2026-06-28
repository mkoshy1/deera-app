"use client";
import { useState } from "react";
import { db } from "@/app/firebase";
import { collection, writeBatch, doc, getDocs, query, where } from "firebase/firestore";

export default function AdminTest() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // بيانات أولية لتوليد المستخدمين الوهميين بلمسة عراقية لـ "ديرة"
  const maleNames = ["أحمد", "حسين", "مصطفى", "مرتضى", "كرار", "علي", "محمد", "يوسف", "حسن", "سجاد", "حيدر", "عباس", "عمر", "زيد", "فهد"];
  const femaleNames = ["فاطمة", "زهراء", "زينب", "مريم", "سارة", "آية", "نور", "هدى", "روان", "شمس", "ريتاج", "دينا", "رنا", "تبارك"];
  const cities = ["النجف", "بغداد", "كربلاء", "البصرة", "أربيل", "الحلة", "الديوانية", "الموصل"];
  const jobs = ["مهندس تكنولوجيا", "طبيب أسنان", "طالب جامعي", "أعمال حرة", "مصمم جرافيك", "محامي", "مدرس لغات", "محاسب", "مدير مبيعات"];
  const bios = [
    "شخص هادئ وأحب القراءة والسفر ✈️",
    "أبحث عن شريك حياة متفهم وصادق 💍",
    "مهتم بالرياضة والتطوير الذاتي واكتساب خبرات جديدة 💪",
    "متفائل دائماً وأحب الحياة البسيطة واللمة العائلية ❤️",
    "أعشق السفر واستكشاف الأماكن الجديدة والمطاعم الكلاسيكية ☕"
  ];

  // صور بورتريه عشوائية جاهزة من Unsplash لتظهر الحسابات حقيقية
  const malePhotos = [
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1501196354995-cbb51c65aaea?q=80&w=400&auto=format&fit=crop"
  ];

  const femalePhotos = [
    "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=400&auto=format&fit=crop"
  ];

  // 🌟 دالة توليد 100 مستخدم وهمي وحفظهم بدفعة واحدة (Batch) لتوفير الوقت والجهد
  const generate100Users = async () => {
    setLoading(true);
    setMessage("جاري توليد الحسابات الوهمية... ⏳");
    const batch = writeBatch(db);

    try {
      for (let i = 0; i < 100; i++) {
        // تحديد الجنس 50% ولد و 50% بنت
        const gender = i % 2 === 0 ? "ذكر" : "أنثى";
        const namePool = gender === "ذكر" ? maleNames : femaleNames;
        const photoPool = gender === "ذكر" ? malePhotos : femalePhotos;

        const name = namePool[Math.floor(Math.random() * namePool.length)] + " " + (i + 1);
        const age = Math.floor(Math.random() * (35 - 20 + 1)) + 20; // عمر بين 20 و 35
        const city = cities[Math.floor(Math.random() * cities.length)];
        const job = jobs[Math.floor(Math.random() * jobs.length)];
        const bio = bios[Math.floor(Math.random() * bios.length)];
        
        // نختار صورتين لكل حساب حتى يشتغل تقليب الصور بالبطاقة
        const p1 = photoPool[Math.floor(Math.random() * photoPool.length)];
        const p2 = photoPool[(Math.floor(Math.random() * photoPool.length) + 1) % photoPool.length];
        const userPhotos = [p1, p2];

        const newUserRef = doc(collection(db, "users"));
        batch.set(newUserRef, {
          name,
          age,
          gender,
          city,
          job,
          bio,
          photos: userPhotos,
          photoURL: p1,
          role: "user",
          isFake: true, // الحقل السري لغرض الفلترة والحذف لاحقاً
          createdAt: new Date()
        });
      }

      await batch.commit();
      setMessage("تمت إضافة 100 مستخدم وهمي بنجاح! 🚀 افتح صفحة الاستكشاف وجرب التطبيق.");
    } catch (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء إضافة المستخدمين.");
    } finally {
      setLoading(false);
    }
  };

  // 🌟 دالة حذف جميع المستخدمين الوهميين وتنظيف قاعدة البيانات
  const deleteFakeUsers = async () => {
    if (!confirm("هل أنت متأكد تريد تنظيف الـ Firestore وحذف الـ 100 مستخدم وهمي؟ 🗑️")) return;
    
    setLoading(true);
    setMessage("جاري حذف الحسابات الوهمية وتنظيف قاعدة البيانات... ⏳");

    try {
      const q = query(collection(db, "users"), where("isFake", "==", true));
      const querySnapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      let count = 0;

      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });

      if (count > 0) {
        await batch.commit();
        setMessage(`تم تنظيف الداتابيز وحذف ${count} مستخدم وهمي بنجاح! ✨`);
      } else {
        setMessage("لا يوجد مستخدمين وهميين لحذفهم حالياً.");
      }
    } catch (error) {
      console.error(error);
      setMessage("حدث خطأ أثناء الحذف.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 font-sans" dir="rtl">
      <div className="bg-gray-900 border border-white/10 rounded-3xl p-8 w-full max-w-md text-center shadow-2xl space-y-6">
        <h1 className="text-2xl font-black text-indigo-400">لوحة اختبار تطبيق ديرة 🛠️</h1>
        <p className="text-gray-400 text-sm">استخدم هذه الصفحة لتوليد بيانات اختبارية ومحاكاة تفاعل المستخدمين الحقيقيين.</p>
        
        {message && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-amber-400 font-mono">
            {message}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button 
            onClick={generate100Users} 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 font-bold py-4 rounded-full transition shadow-lg cursor-pointer disabled:opacity-50"
          >
            🚀 إضافة 100 مستخدم وهمي فوري
          </button>

          <button 
            onClick={deleteFakeUsers} 
            disabled={loading}
            className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 font-bold py-4 rounded-full transition cursor-pointer disabled:opacity-50"
          >
            🗑️ مسح وتنظيف الوهميين
          </button>
        </div>
      </div>
    </div>
  );
}