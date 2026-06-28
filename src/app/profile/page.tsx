"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/app/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { motion } from "framer-motion";

export default function Profile() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState<any>("");

  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentUploadTarget, setCurrentUploadTarget] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [showPlans, setShowPlans] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const calculateProgress = (data: any) => {
    if (!data) return 0;
    const fields = ['photoURL', 'photos', 'bio', 'lookingFor', 'name', 'age', 'city', 'height', 'maritalStatus', 'education', 'languages', 'job'];
    let filled = 0;
    if (data.photoURL) filled++;
    if (data.photos && data.photos.length > 0) filled++;
    if (data.bio) filled++;
    if (data.lookingFor) filled++;
    if (data.name) filled++;
    if (data.age) filled++;
    if (data.city) filled++;
    if (data.height) filled++;
    if (data.maritalStatus) filled++;
    if (data.education) filled++;
    if (data.languages) filled++;
    if (data.job) filled++;
    return Math.round((filled / fields.length) * 100);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            let data = userDoc.data();
            if (data.role === "vip" && data.endDate) {
              const expiryDate = data.endDate.toDate();
              const now = new Date();
              if (now > expiryDate) {
                await updateDoc(userDocRef, { role: "user" });
                data = { ...data, role: "user" };
              }
            }
            setUserData(data);
            setPhotos(data.photos || (data.photoURL ? [data.photoURL] : []));
          }
          setLoading(false);
        } catch (error) {
          setLoading(false);
        }
      } else {
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleLogout = async () => {
    if (confirm("هل أنت متأكد تريد تسجيل الخروج؟ 🚪")) {
      await signOut(auth);
      router.push("/"); 
    }
  };

  const handleSaveField = async (field: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), { [field]: tempValue });
      setUserData((prev: any) => ({ ...prev, [field]: tempValue }));
      setEditingField(null);
    } catch (error) {
      console.error("خطأ في الحفظ:", error);
    }
  };

  // رفع مباشر بدون تأخير أو ذكاء اصطناعي
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser || currentUploadTarget === null) return;

    if (photos.length >= 6 && currentUploadTarget === photos.length) {
      alert("الحد الأقصى هو 6 صور فقط! 📷");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("image", file);
      const imgbbAPIKey = "c2540ad59fcbc5191a0907ea1129816d"; 

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbAPIKey}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        const newPhotoURL = data.data.display_url;
        let updatedPhotos = [...photos];

        if (currentUploadTarget < updatedPhotos.length) {
          updatedPhotos[currentUploadTarget] = newPhotoURL;
        } else {
          updatedPhotos.push(newPhotoURL);
        }
        
        await updateDoc(doc(db, "users", auth.currentUser!.uid), {
          photos: updatedPhotos,
          photoURL: updatedPhotos[0] 
        });

        setPhotos(updatedPhotos);
        setUserData((prev: any) => ({ ...prev, photos: updatedPhotos, photoURL: updatedPhotos[0] }));
      } else {
        alert("❌ فشل رفع الصورة.");
      }
    } catch (error) {
      alert("❌ حدث خطأ بالاتصال.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerFileInput = (targetIdx: number) => {
    setCurrentUploadTarget(targetIdx);
    fileInputRef.current?.click();
  };

  const deleteGalleryPhoto = async (indexToDelete: number) => {
    if (indexToDelete === 0) {
      alert("لا يمكن حذف الصورة الأساسية! يمكنك تعديلها فقط بالضغط على القلم. 🚫");
      return;
    }
    if (!confirm("هل تريد حذف هذه الصورة؟ 🗑️")) return;
    if (!auth.currentUser) return;
    
    const updatedPhotos = photos.filter((_, index) => index !== indexToDelete);
    
    try {
      await updateDoc(doc(db, "users", auth.currentUser.uid), {
        photos: updatedPhotos,
        photoURL: updatedPhotos[0]
      });
      setPhotos(updatedPhotos);
      setUserData((prev: any) => ({ ...prev, photos: updatedPhotos, photoURL: updatedPhotos[0] }));
    } catch (error) {
      alert("حدث خطأ أثناء الحذف.");
    }
  };

  const handleSelectPlan = async (planName: string) => {
    if (!auth.currentUser) return;
    setProcessingPayment(true);
    const daysMap: { [key: string]: number } = { "شهر واحد": 30, "3 أشهر": 90, "سنة كاملة": 365 };
    const daysToAdd = daysMap[planName] || 30;
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + daysToAdd); 

    setTimeout(async () => {
      try {
        await updateDoc(doc(db, "users", auth.currentUser!.uid), { role: "vip", planName, startDate: new Date(), endDate });
        setUserData((prev: any) => ({ ...prev, role: "vip", endDate }));
        setProcessingPayment(false);
        setShowPlans(false);
        alert(`مبروك! اشتراكك فعال لغاية: ${endDate.toLocaleDateString('ar-IQ')} ⭐`);
      } catch (error) {
        setProcessingPayment(false);
      }
    }, 2000);
  };

  if (loading) return <div className="h-[100dvh] bg-gray-950 flex items-center justify-center text-white"><span className="animate-pulse">جاري تحميل الملف...</span></div>;

  const progress = calculateProgress(userData);
  const slots = Array.from({ length: 6 });

  const maritalOptions = ["أعزب / عزباء", "مطلق / مطلقة", "أرمل / أرملة", "منفصل / منفصلة"];
  const eduOptions = ["بدون شهادة", "ثانوي", "دبلوم", "بكالوريوس", "ماجستير", "دكتوراه"];
  const jobOptions = ["طالب", "موظف حكومي", "قطاع خاص", "أعمال حرة", "بدون عمل", "أخرى"];

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans pb-24 relative" dir="rtl">
      
      <div className="fixed top-0 left-0 right-0 h-1.5 bg-gray-800 z-50">
        <div className="h-full bg-red-500 transition-all duration-1000 ease-out shadow-[0_0_10px_red]" style={{ width: `${progress}%` }}></div>
      </div>

      <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />

      <div className="flex justify-between items-center p-6 pt-8">
        <button onClick={() => router.push("/discover")} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md hover:bg-white/20 transition">
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
        </button>
        <h1 className="text-xl font-bold font-['Calibri'] text-gray-200">ملفي الشخصي ⚙️</h1>
        <div className="w-10 h-10 flex items-center justify-center text-pink-500 font-black">{progress}%</div>
      </div>

      <div className="flex flex-col items-center mt-2 relative">
        <div className="relative">
          <div className="w-36 h-36 rounded-full border-4 border-gray-800 shadow-2xl overflow-hidden relative bg-gray-900 flex items-center justify-center">
            {(isUploading && currentUploadTarget === 0) ? (
              <span className="animate-spin text-3xl">⏳</span>
            ) : (
              <img src={photos[0] || userData?.photoURL} className="w-full h-full object-cover" />
            )}
          </div>
          
          <button 
            onClick={() => {
              if (!isEditMode) setIsEditMode(true);
              else triggerFileInput(0); 
            }}
            className="absolute bottom-2 right-2 w-10 h-10 bg-pink-600 rounded-full flex items-center justify-center shadow-lg border-2 border-gray-950 hover:bg-pink-500 transition-transform active:scale-95 z-30 cursor-pointer"
          >
            ✏️
          </button>
        </div>
        
        {!isEditMode && (
          <div className="mt-4 text-center">
            <h2 className="text-2xl font-black flex items-center justify-center gap-2">
              {userData?.name}
              {userData?.role === "admin" && <span className="text-[10px] bg-red-600 px-2 py-0.5 rounded-md text-white font-bold animate-pulse">مطور</span>}
              {userData?.role === "vip" && <span className="text-[10px] bg-amber-500 px-2 py-0.5 rounded-md text-white font-bold">VIP</span>}
            </h2>
            <p className="text-gray-400 text-sm mt-1">{userData?.age} سنة • 📍 {userData?.city}</p>
            
            <div className="w-[90%] mx-auto mt-6">
              {userData?.role !== "admin" && userData?.role !== "vip" && (
                <div className="w-full bg-linear-to-r from-pink-600 to-indigo-600 rounded-3xl p-5 text-center shadow-xl mt-2 mb-4">
                  <h3 className="font-black text-xl mb-1">ديرة VIP ⭐</h3>
                  <p className="text-xs text-white/80 mb-4">أرسل سوبر لايك وافتح الخاص فوراً!</p>
                  <button onClick={() => setShowPlans(true)} className="w-full bg-white text-indigo-950 font-bold py-3 rounded-full shadow-md text-sm cursor-pointer hover:bg-gray-100 transition">عرض باقات الاشتراك</button>
                </div>
              )}
              <button onClick={handleLogout} className="w-full bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 py-4 rounded-full font-bold transition-all text-center mb-4 cursor-pointer">تسجيل الخروج 🚪</button>
            </div>
          </div>
        )}
      </div>

      {isEditMode && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="px-6 mt-6">
          <h2 className="text-center font-medium text-lg text-pink-400 font-['Calibri'] mb-6 drop-shadow-md">أكمل أو عدّل تفاصيل ملفك</h2>

          <button onClick={() => setShowPhotoGallery(!showPhotoGallery)} className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center mb-6 cursor-pointer">
            <span className="font-bold text-gray-200">📸 أضف المزيد من الصور ({photos.length}/6)</span>
            <span>{showPhotoGallery ? '🔽' : '◀️'}</span>
          </button>

          {showPhotoGallery && (
            <div className="grid grid-cols-3 gap-3 mb-8 bg-black/40 p-4 rounded-3xl border border-white/5">
              {slots.map((_, idx) => {
                const photoUrl = photos[idx];
                const uploadingThis = isUploading && currentUploadTarget === idx;

                return (
                  <div key={idx} className="aspect-[3/4] bg-gray-900 rounded-xl relative overflow-hidden border border-white/10 flex items-center justify-center">
                    {uploadingThis ? (
                      <span className="animate-spin text-2xl">⏳</span>
                    ) : photoUrl ? (
                      <>
                        <img src={photoUrl} className="w-full h-full object-cover" />
                        {idx !== 0 && ( 
                          <button onClick={() => deleteGalleryPhoto(idx)} className="absolute top-1 right-1 w-6 h-6 bg-red-500/90 rounded-full text-[10px] flex items-center justify-center backdrop-blur-sm cursor-pointer shadow-md">❌</button>
                        )}
                        {idx === 0 && <span className="absolute top-1 right-1 bg-indigo-500 text-[8px] px-2 py-0.5 rounded-full font-bold">أساسية</span>}
                      </>
                    ) : (
                      idx === photos.length ? (
                        <button onClick={() => triggerFileInput(idx)} className="w-full h-full flex flex-col items-center justify-center text-gray-500 hover:text-white transition cursor-pointer">
                          <span className="text-2xl mb-1">+</span><span className="text-[10px]">إضافة</span>
                        </button>
                      ) : null
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <FieldEditor title="عنّي 📝" field="bio" value={userData?.bio} type="textarea" placeholder="اكتب نبذة عنك..." isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />
          <FieldEditor title="أبحث عن 🔍" field="lookingFor" value={userData?.lookingFor} type="textarea" placeholder="مواصفات الشريك الذي تبحث عنه..." isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />

          <div className="mt-8">
            <h3 className="text-xl font-bold mb-4 text-indigo-400">تفاصيل عامة 👤</h3>
            <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
              <ReadOnlyRow label="جنسي" value={userData?.gender || "غير محدد"} />
              <FieldRow label="الاسم" field="name" value={userData?.name} type="text" isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />
              <FieldRow label="العمر" field="age" value={userData?.age} type="number" isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />
              <FieldRow label="العنوان" field="city" value={userData?.city} type="text" isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />
              <ReadOnlyRow label="البرج" value={userData?.zodiac || "غير محدد"} />
            </div>
          </div>

          <div className="mt-8 mb-10">
            <h3 className="text-xl font-bold mb-4 text-pink-400">المزيد عنّي 📋</h3>
            <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
              <FieldRow label="الطول (سم)" field="height" value={userData?.height} type="number" isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />
              <FieldRow label="الحالة" field="maritalStatus" value={userData?.maritalStatus} type="select" options={maritalOptions} isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />
              <FieldRow label="الشهادة" field="education" value={userData?.education} type="select" options={eduOptions} isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />
              <FieldRow label="اللغات" field="languages" value={userData?.languages} type="text" placeholder="مثال: العربية، الانجليزية" isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />
              <FieldRow label="الوظيفة" field="job" value={userData?.job} type="select" options={jobOptions} isEditing={editingField} setEditing={setEditingField} setTemp={setTempValue} temp={tempValue} onSave={handleSaveField} />
            </div>
          </div>

          <button onClick={() => setIsEditMode(false)} className="w-full bg-indigo-600 font-bold py-4 rounded-full mb-10 text-lg hover:bg-indigo-500 shadow-lg cursor-pointer">
            إكمال وإنهاء التعديل ✔️
          </button>
        </motion.div>
      )}

      {showPlans && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl flex flex-col">
            <button onClick={() => setShowPlans(false)} className="absolute top-4 left-4 text-gray-400 hover:text-white cursor-pointer">❌</button>
            <h2 className="text-2xl font-black text-center mb-2 mt-4">اختر باقتك ⭐</h2>
            <p className="text-gray-400 text-center text-sm mb-6">احصل على وصول غير محدود لكل الميزات</p>
            <div className="space-y-3">
              <button onClick={() => handleSelectPlan("شهر واحد")} disabled={processingPayment} className="w-full border border-gray-600 hover:border-pink-500 bg-gray-800 rounded-2xl p-4 flex justify-between items-center transition cursor-pointer group disabled:opacity-50">
                <div className="text-right"><h3 className="font-bold text-lg group-hover:text-pink-400">شهر واحد</h3><p className="text-xs text-gray-400">مثالية للتجربة</p></div><div className="font-black text-xl">10$</div>
              </button>
              <button onClick={() => handleSelectPlan("3 أشهر")} disabled={processingPayment} className="w-full border-2 border-indigo-500 bg-indigo-900/30 rounded-2xl p-4 flex justify-between items-center transition cursor-pointer relative disabled:opacity-50">
                <span className="absolute -top-3 right-4 bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-full">الأكثر مبيعاً 🔥</span>
                <div className="text-right"><h3 className="font-bold text-lg text-indigo-300">3 أشهر</h3><p className="text-xs text-indigo-400/80">وفر 15%</p></div><div className="font-black text-xl">25$</div>
              </button>
              <button onClick={() => handleSelectPlan("سنة كاملة")} disabled={processingPayment} className="w-full border border-gray-600 hover:border-pink-500 bg-gray-800 rounded-2xl p-4 flex justify-between items-center transition cursor-pointer group disabled:opacity-50">
                <div className="text-right"><h3 className="font-bold text-lg group-hover:text-pink-400">سنة كاملة</h3><p className="text-xs text-gray-400">وفر 50%</p></div><div className="font-black text-xl">60$</div>
              </button>
            </div>
            {processingPayment && (
              <div className="absolute inset-0 bg-gray-900/90 rounded-3xl flex flex-col items-center justify-center z-10"><span className="animate-spin text-4xl mb-3">🔄</span><p className="font-bold animate-pulse">جاري التفعيل...</p></div>
            )}
          </div>
        </div>
      )}

      {!isEditMode && (
        <div className="bg-gray-950/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center p-4 pb-6 fixed bottom-0 inset-x-0 z-40">
          <button onClick={() => router.push("/discover")} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition cursor-pointer"><span className="text-2xl">🔥</span><span className="text-xs font-bold">استكشف</span></button>
          <button onClick={() => router.push("/messages")} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition cursor-pointer"><span className="text-2xl">💬</span><span className="text-xs font-bold">الرسائل</span></button>
          <button className="flex flex-col items-center gap-1 text-pink-500 cursor-pointer"><span className="text-2xl">⚙️</span><span className="text-xs font-bold">حسابي</span></button>
        </div>
      )}
    </div>
  );
}

// ================= Components المساعدة مع إصلاح العرض =================
function FieldEditor({ title, field, value, type, placeholder, isEditing, setEditing, setTemp, temp, onSave }: any) {
  const isThisEditing = isEditing === field;
  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-gray-200">{title}</h3>
        {!isThisEditing && <button onClick={() => { setEditing(field); setTemp(value || ""); }} className="text-pink-500 text-sm font-bold flex items-center gap-1 cursor-pointer hover:underline">تعديل ✏️</button>}
      </div>
      {isThisEditing ? (
        <div className="bg-gray-900 border border-pink-500/50 rounded-2xl p-1">
          {type === "textarea" ? <textarea value={temp} onChange={(e) => setTemp(e.target.value)} placeholder={placeholder} className="w-full bg-transparent p-3 outline-hidden text-white min-h-[100px] resize-none" /> : <input type="text" value={temp} onChange={(e) => setTemp(e.target.value)} className="w-full bg-transparent p-3 outline-hidden text-white" />}
          <div className="flex justify-end gap-2 p-2 border-t border-gray-800">
            <button onClick={() => setEditing(null)} className="px-4 py-1.5 text-gray-400 text-sm hover:text-white rounded-full cursor-pointer">إلغاء</button>
            <button onClick={() => onSave(field)} className="px-4 py-1.5 bg-pink-600 text-white text-sm font-bold rounded-full cursor-pointer hover:bg-pink-500">حفظ</button>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/5 p-4 rounded-2xl text-gray-300 text-sm shadow-inner min-h-[60px]">{value || <span className="text-gray-600">لم تقم بالإضافة بعد.</span>}</div>
      )}
    </div>
  );
}

function ReadOnlyRow({ label, value }: any) {
  return (
    <div className="flex justify-between items-center p-4 border-b border-white/5 last:border-0 bg-black/20 gap-2">
      <span className="text-gray-400 font-medium whitespace-nowrap">{label}</span>
      <span className="text-gray-500 font-bold flex items-center gap-2 truncate">{value} 🔒</span>
    </div>
  );
}

function FieldRow({ label, field, value, type, options, placeholder, isEditing, setEditing, setTemp, temp, onSave }: any) {
  const isThisEditing = isEditing === field;
  return (
    <div className="flex justify-between items-center p-4 border-b border-white/5 last:border-0 transition-colors gap-3">
      <span className="text-gray-300 font-medium whitespace-nowrap">{label}</span>
      {isThisEditing ? (
        <div className="flex-1 flex items-center gap-1 min-w-0">
          {type === "select" ? (
            <select value={temp} onChange={(e) => setTemp(e.target.value)} className="flex-1 w-full bg-gray-800 border border-pink-500/50 rounded-lg p-2 outline-hidden text-white text-xs appearance-none min-w-0">
              <option value="">اختر...</option>{options.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : (
            <input type={type} value={temp} onChange={(e) => setTemp(e.target.value)} placeholder={placeholder} className="flex-1 w-full bg-gray-800 border border-pink-500/50 rounded-lg p-2 outline-hidden text-white text-xs min-w-0" />
          )}
          <button onClick={() => onSave(field)} className="bg-green-500 hover:bg-green-400 text-white p-2 rounded-lg cursor-pointer shrink-0">✔</button>
          <button onClick={() => setEditing(null)} className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-lg cursor-pointer shrink-0">✖</button>
        </div>
      ) : (
        <div className="flex-1 flex justify-end items-center cursor-pointer group gap-2 min-w-0" onClick={() => { setEditing(field); setTemp(value || ""); }}>
          <span className={`font-bold text-sm truncate ${value ? 'text-white' : 'text-gray-600'}`}>{value || "أضف الآن"}</span>
          <span className="text-gray-600 group-hover:text-pink-500 transition-colors shrink-0">✏️</span>
        </div>
      )}
    </div>
  );
}