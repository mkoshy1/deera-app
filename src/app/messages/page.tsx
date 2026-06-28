"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/app/firebase"; // استخدام الـ @ المضمون
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function MessagesList() {
  const router = useRouter();
  
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);
        try {
          // 1. الاستعلام عن كل الغرف التي يكون المستخدم الحالي طرفاً فيها
          const chatsQuery = query(
            collection(db, "chats"),
            where("users", "array-contains", user.uid)
          );
          
          const querySnapshot = await getDocs(chatsQuery);
          const activeChats: any[] = [];

          // 2. تدوير على الغرف لجلب بيانات الطرف الثاني في كل محادثة
          for (const chatDoc of querySnapshot.docs) {
            const chatData = chatDoc.data();
            const uids = chatData.users as string[];
            
            // العثور على آيدي الشخص الآخر
            const partnerId = uids.find((id) => id !== user.uid);

            if (partnerId) {
              // جلب اسم وبيانات الشخص الآخر من مجلد users
              const partnerDoc = await getDoc(doc(db, "users", partnerId));
              if (partnerDoc.exists()) {
                activeChats.push({
                  id: chatDoc.id, // آيدي غرفة الدردشة
                  partnerInfo: partnerDoc.data(), // اسم وعمر وصورة الشخص الثاني
                });
              }
            }
          }

          setChats(activeChats);
          setLoading(false);
        } catch (error) {
          console.error("خطأ في جلب قائمة المحادثات:", error);
          setLoading(false);
        }
      } else {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-950 via-indigo-950 to-black flex items-center justify-center text-white font-sans" dir="rtl">
        <span className="animate-pulse">جاري جلب محادثاتك الآمنة... 💬</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-950 via-indigo-950 to-black flex flex-col font-sans text-white" dir="rtl">
      
      {/* الرأس (Header) */}
      <div className="p-6 pb-4 border-b border-white/10 flex items-center justify-between">
        <h1 className="text-2xl font-bold">صندوق الرسائل 💬</h1>
        <button onClick={() => router.push("/discover")} className="text-sm bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition">
          الرئيسية
        </button>
      </div>

      {/* قائمة المحادثات النشطة */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 mt-20 text-center">
            <span className="text-6xl mb-4">💬</span>
            <p className="text-lg">صندوق الوارد فارغ حالياً</p>
            <p className="text-sm px-6">انقر على النجمة ⭐ أو انتظر ردود الإعجاب لبدء محادثات جديدة!</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => router.push(`/chat/${chat.id}`)} // النقر ينقلك فوراً للغرفة السابقة برقمها الفريد
              className="flex items-center gap-4 bg-white/5 border border-white/5 hover:border-white/20 p-4 rounded-3xl cursor-pointer transition-all duration-200 transform active:scale-98 group"
            >
              {/* صورة الشخص الثاني (أول حرف من اسمه) */}
              <div className="w-14 h-14 bg-linear-to-tr from-pink-500 to-indigo-500 rounded-full flex items-center justify-center text-xl font-bold border border-white/10 shadow-md group-hover:scale-105 transition-transform">
                {chat.partnerInfo?.name ? chat.partnerInfo.name[0] : "?"}
              </div>

              {/* تفاصيل المحادثة */}
              <div className="flex-1">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-bold text-lg text-white group-hover:text-pink-400 transition-colors">
                    {chat.partnerInfo?.name}
                  </h3>
                  <span className="text-xs text-gray-500">{chat.partnerInfo?.age} سنة</span>
                </div>
<p className="text-sm text-gray-400 truncate max-w-55">
                      انقر هنا لعرض المحادثة والرسائل السابقة ومواصلة الدردشة الحية...
                </p>
              </div>

              {/* سهم مؤشر الدخول */}
              <div className="text-gray-600 group-hover:text-white transition-colors text-xl">
                ↩️
              </div>
            </div>
          ))
        )}
      </div>

      {/* شريط التنقل السفلي */}
      <div className="bg-gray-950/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center p-4 pb-6">
        <button onClick={() => router.push("/discover")} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition">
          <span className="text-2xl">🔥</span><span className="text-xs font-bold">استكشف</span>
        </button>
        {/* زر الرسائل مفعل الآن باللون الوردي */}
        <button className="flex flex-col items-center gap-1 text-pink-500">
          <span className="text-2xl">💬</span><span className="text-xs font-bold">الرسائل</span>
        </button>
<button onClick={() => router.push("/profile")} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition">
  <span className="text-2xl">⚙️</span><span className="text-xs font-bold">حسابي</span>
</button>
      </div>

    </div>
  );
}