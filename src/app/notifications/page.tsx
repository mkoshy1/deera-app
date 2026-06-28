"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/app/firebase"; 
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function Notifications() {
  const router = useRouter();
  
  const [likes, setLikes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [canView, setCanView] = useState(false); 

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const role = userDoc.exists() ? userDoc.data().role : "user";
          if (role === "admin" || role === "vip") {
            setCanView(true);
          }

          const likesQuery = query(collection(db, "likes"), where("toUserId", "==", user.uid));
          const likesSnapshot = await getDocs(likesQuery);
          
          const likesData: any[] = [];
          
          for (const likeDoc of likesSnapshot.docs) {
            const likeInfo = likeDoc.data();
            const senderDoc = await getDoc(doc(db, "users", likeInfo.fromUserId));
            
            if (senderDoc.exists()) {
              likesData.push({
                id: likeDoc.id, 
                senderId: senderDoc.id,
                ...senderDoc.data() 
              });
            }
          }

          setLikes(likesData);
          setLoading(false);

        } catch (error) {
          console.error("خطأ في جلب الإشعارات:", error);
          setLoading(false);
        }
      } else {
        router.push("/");
      }
    });

    return () => unsubscribe();
  }, [router]);

  // دالة الترقية الفورية من داخل صفحة الإشعارات
  const handleUpgradeToVIP = async () => {
    const loggedInUser = auth.currentUser;
    if (!loggedInUser) return;
    try {
      await updateDoc(doc(db, "users", loggedInUser.uid), {
        role: "vip"
      });
      setCanView(true); // كشف الحجب عن الصور فوراً بالشاشة
      alert("تفوووز! ⭐ تم تفعيل ديرة VIP مباشرة، وهسه تكدر تشوف كل الناس العاجبهم حسابك بدون أي تغبيش وتراسلهم!");
    } catch (error) {
      console.error("خطأ في الترقية:", error);
      alert("حدث خطأ أثناء تفعيل الاشتراك.");
    }
  };

  const handleStartChat = async (senderId: string) => {
    const loggedInUser = auth.currentUser;
    if (!loggedInUser) return;
    try {
      const chatId = loggedInUser.uid < senderId 
        ? `${loggedInUser.uid}_${senderId}` 
        : `${senderId}_${loggedInUser.uid}`;

      await setDoc(doc(db, "chats", chatId), {
        users: [loggedInUser.uid, senderId],
        createdAt: new Date(),
      }, { merge: true });

      router.push(`/chat/${chatId}`);
    } catch (error) {
      console.error("خطأ في فتح المحادثة:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-950 via-indigo-950 to-black flex items-center justify-center text-white font-sans" dir="rtl">
        <span className="animate-pulse">جاري تحميل الإشعارات... 🔔</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-950 via-indigo-950 to-black flex flex-col font-sans text-white relative" dir="rtl">
      
      <div className="p-6 pb-4 border-b border-white/10 flex items-center justify-between z-10">
        <h1 className="text-2xl font-bold">من أعجب بك 💖</h1>
        <button onClick={() => router.push("/discover")} className="text-sm bg-white/10 px-4 py-2 rounded-full hover:bg-white/20 transition cursor-pointer">
          رجوع
        </button>
      </div>

      <div className="flex-1 p-4 overflow-y-auto pb-28">
        
        {!canView && likes.length > 0 && (
          <div className="bg-linear-to-r from-pink-600 to-indigo-600 rounded-3xl p-5 mb-6 text-center shadow-xl">
            <h3 className="font-bold text-lg mb-1">اكتشف من معجب بك! 🔒</h3>
            <p className="text-sm text-white/80 mb-4">اشترك في ديرة VIP لرؤية الصور والأسماء بوضوح.</p>
            {/* ربط الزر بالدالة الجديدة */}
            <button onClick={handleUpgradeToVIP} className="bg-white text-indigo-900 font-bold px-8 py-3 rounded-full shadow-md text-sm cursor-pointer hover:bg-gray-100 transition">
              ترقية الآن
            </button>
          </div>
        )}

        {likes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 mt-20">
            <span className="text-6xl mb-4">📭</span>
            <p className="text-lg">لا توجد إعجابات حتى الآن</p>
            <p className="text-sm">استمر في تصفح التطبيق لزيادة فرصك!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {likes.map((sender, index) => (
              <div key={index} className="relative bg-white/5 border border-white/10 rounded-3xl p-4 flex flex-col items-center text-center overflow-hidden">
                
                <div className={`w-full flex flex-col items-center transition-all duration-300 ${!canView ? "filter blur-md select-none pointer-events-none" : ""}`}>
                  <div className="w-20 h-20 rounded-full mb-3 overflow-hidden border-2 border-white/20 shadow-lg bg-gray-800 flex items-center justify-center text-2xl">
                    {sender.photoURL || (sender.photos && sender.photos[0]) ? (
                      <img src={sender.photoURL || sender.photos[0]} alt="صورة المستخدم" className="w-full h-full object-cover" />
                    ) : (
                      sender.name ? sender.name[0] : "?"
                    )}
                  </div>
                  <h3 className="font-bold text-lg truncate w-full">{sender.name || "مستخدم"}</h3>
                  <p className="text-sm text-gray-400 mb-4">{sender.age ? `${sender.age} سنة` : ""}</p>
                </div>

                {!canView && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10">
                    <span className="text-4xl drop-shadow-2xl">🔒</span>
                  </div>
                )}

                {canView && (
                  <button onClick={() => handleStartChat(sender.senderId)} className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-6 rounded-full transition shadow-lg cursor-pointer">
                    مراسلة 💬
                  </button>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-gray-950/80 backdrop-blur-xl border-t border-white/10 flex justify-around items-center p-4 pb-6 fixed bottom-0 inset-x-0 z-50">
        <button onClick={() => router.push("/discover")} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition cursor-pointer">
          <span className="text-2xl">🔥</span><span className="text-xs font-bold">استكشف</span>
        </button>
        <button onClick={() => router.push("/messages")} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition cursor-pointer">
          <span className="text-2xl">💬</span><span className="text-xs font-bold">الرسائل</span>
        </button>        
        <button onClick={() => router.push("/profile")} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition cursor-pointer">
          <span className="text-2xl">⚙️</span><span className="text-xs font-bold">حسابي</span>
        </button>
      </div>

    </div>
  );
}