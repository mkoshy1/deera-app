"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, auth } from "@/app/firebase";
import { collection, doc, getDoc, addDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function ChatRoom() {
  const router = useRouter();
  const params = useParams();
  const chatId = params.id as string; // الحصول على آيدي الغرفة من الرابط
  
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatPartner, setChatPartner] = useState<any>(null); // بيانات الشخص الذي تراسله
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null); // للنزول التلقائي لآخر رسالة

  // السكرول التلقائي لأسفل الشاشة عند وصول رسالة جديدة
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUserId(user.uid);

        try {
          // 1. معرفة من هو الطرف الثاني في المحادثة من خلال الـ chatId (المتكون من آيديين بينهما _)
          const uids = chatId.split("_");
          const partnerId = uids.find((id) => id !== user.uid);

          if (partnerId) {
            // جلب اسم وبيانات الطرف الثاني لعرضها في أعلى الشاشة
            const partnerDoc = await getDoc(doc(db, "users", partnerId));
            if (partnerDoc.exists()) {
              setChatPartner(partnerDoc.data());
            }
          }

          // 2. الاستماع الفوري والحي (Real-time) للرسائل داخل هذه الغرفة
          const messagesQuery = query(
            collection(db, "chats", chatId, "messages"),
            orderBy("createdAt", "asc")
          );

          const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
            const msgs: any[] = [];
            snapshot.forEach((doc) => {
              msgs.push({ id: doc.id, ...doc.data() });
            });
            setMessages(msgs);
            setLoading(false);
          });

          return () => unsubscribeMessages();

        } catch (error) {
          console.error("خطأ في تحميل المحادثة:", error);
          setLoading(false);
        }
      } else {
        router.push("/");
      }
    });

    return () => unsubscribeAuth();
  }, [chatId, router]);

  // دالة إرسال الرسالة
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUserId) return;

    try {
      // حفظ الرسالة داخل مجلد فرعي (Subcollection) تابع للغرفة نفسها
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: newMessage.trim(),
        senderId: currentUserId,
        createdAt: new Date(),
      });

      setNewMessage(""); // تفريغ حقل الكتابة
    } catch (error) {
      console.error("فشل إرسال الرسالة:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-gray-950 via-indigo-950 to-black flex items-center justify-center text-white font-sans" dir="rtl">
        <span className="animate-pulse">جاري فتح المحادثة الآمنة... 💬</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-950 via-indigo-950 to-black flex flex-col font-sans text-white relative" dir="rtl">
      
      {/* 1. الشريط العلوي للمحادثة (Header) */}
      <div className="p-4 pt-6 bg-gray-950/50 backdrop-blur-md border-b border-white/10 flex items-center gap-4 z-10">
<button onClick={() => router.push("/messages")} className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-xl hover:bg-white/10 transition">
  ➡️
</button>
        
        {/* صورة الشخص (أول حرف من اسمه) */}
        <div className="w-12 h-12 bg-linear-to-tr from-pink-500 to-indigo-500 rounded-full flex items-center justify-center text-xl font-bold border border-white/20 shadow-md">
          {chatPartner?.name ? chatPartner.name[0] : "?"}
        </div>

        <div>
          <h2 className="font-bold text-lg">{chatPartner?.name || "مستخدم ديرة"}</h2>
          <p className="text-xs text-green-400 flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span> متصل الآن
          </p>
        </div>
      </div>

      {/* 2. منطقة عرض الرسائل */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 pb-24">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-3xl mb-2">🤝</p>
            <p className="text-sm">هذه بداية محادثتكم المباشرة.</p>
            <p className="text-xs text-gray-600">أرسل رسالة لتبديد الجليد!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[75%] px-4 py-3 rounded-3xl text-sm shadow-md transition-all ${
                  isMe 
                    ? "bg-indigo-600 text-white rounded-br-sm" // رسائلك باللون الأزرق
                    : "bg-white/10 text-gray-100 backdrop-blur-sm border border-white/5 rounded-bl-sm" // رسائل الطرف الآخر
                }`}>
                  <p className="break-all">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        {/* نقطة مرجعية للنزول التلقائي */}
        <div ref={messagesEndRef} />
      </div>

      {/* 3. شريط إدخال وإرسال الرسائل السفلي */}
      <form onSubmit={handleSendMessage} className="absolute bottom-0 inset-x-0 p-4 bg-gray-950/80 backdrop-blur-xl border-t border-white/10 flex gap-3 items-center z-10">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          type="text"
          placeholder="اكتب رسالة..."
          className="flex-1 bg-white/5 border border-white/10 p-4 rounded-full outline-none text-white placeholder-gray-500 focus:border-indigo-500 transition"
        />
        <button type="submit" className="w-14 h-14 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center text-xl shadow-lg shadow-indigo-900/40 transition-all transform active:scale-95">
          🚀
        </button>
      </form>

    </div>
  );
}