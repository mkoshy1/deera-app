"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/app/firebase"; 
import { collection, getDocs, addDoc, doc, getDoc, setDoc, query, where, updateDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion, PanInfo, useMotionValue, useTransform, animate } from "framer-motion";

interface ActionHistoryItem {
  index: number;
  docId: string;
  collectionName: "likes" | "passes";
}

export default function Discover() {
  const router = useRouter();
  
  const [users, setUsers] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const [userData, setUserData] = useState<any>(null);
  const [hasNotifications, setHasNotifications] = useState(false);
  
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
  const [showFullProfile, setShowFullProfile] = useState(false);

  const [matchData, setMatchData] = useState<any>(null); 
  const [showPlans, setShowPlans] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const rotate = useTransform(dragX, [-200, 200], [-15, 15]);

  const passOpacity = useTransform(dragX, [20, 120], [0, 1]);
  const likeOpacity = useTransform(dragX, [-20, -120], [0, 1]);
  const superLikeOpacity = useTransform(dragY, [-20, -120], [0, 1]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (loggedInUser) => {
      if (loggedInUser) {
        try {
          const userDocRef = doc(db, "users", loggedInUser.uid);
          const userDoc = await getDoc(userDocRef);
          let currentUserData = null;

          if (userDoc.exists()) {
            currentUserData = userDoc.data();
            if (currentUserData.role === "vip" && currentUserData.endDate) {
              if (new Date() > currentUserData.endDate.toDate()) {
                await updateDoc(userDocRef, { role: "user" });
                currentUserData.role = "user";
              }
            }
            setUserData(currentUserData);
          }

          const notificationsQuery = query(collection(db, "likes"), where("toUserId", "==", loggedInUser.uid));
          const notifSnapshot = await getDocs(notificationsQuery);
          setHasNotifications(!notifSnapshot.empty);

          const interactedIds = new Set<string>();
          const myLikesQuery = query(collection(db, "likes"), where("fromUserId", "==", loggedInUser.uid));
          const myLikesSnapshot = await getDocs(myLikesQuery);
          myLikesSnapshot.forEach(doc => interactedIds.add(doc.data().toUserId));

          const myPassesQuery = query(collection(db, "passes"), where("fromUserId", "==", loggedInUser.uid));
          const myPassesSnapshot = await getDocs(myPassesQuery);
          myPassesSnapshot.forEach(doc => interactedIds.add(doc.data().toUserId));

          const usersSnapshot = await getDocs(collection(db, "users"));
          const usersList: any[] = [];
          
          usersSnapshot.forEach((doc) => {
            if (doc.id !== loggedInUser.uid && !interactedIds.has(doc.id)) {
              const data = doc.data();
              data.photos = data.photos && data.photos.length > 0 ? data.photos : (data.photoURL ? [data.photoURL] : []);
              usersList.push({ id: doc.id, ...data });
            }
          });

          setUsers(usersList.sort(() => Math.random() - 0.5));
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

  const advanceCard = () => {
    setCurrentIndex((prev) => prev + 1);
    setCurrentPhotoIndex(0);
    setShowFullProfile(false);
  };

  const handleUndo = async () => {
    if (userData?.role !== "vip" && userData?.role !== "admin") {
      setShowPlans(true); return;
    }
    if (actionHistory.length === 0) return;

    const lastAction = actionHistory[actionHistory.length - 1];
    try {
      await deleteDoc(doc(db, lastAction.collectionName, lastAction.docId));
      setCurrentIndex(lastAction.index);
      setActionHistory(prev => prev.slice(0, -1));
    } catch (error) {}
  };

  const handlePass = async () => {
    const targetUser = users[currentIndex];
    const loggedInUser = auth.currentUser;
    if (!loggedInUser || !targetUser) return;
    if (dragX.get() < 100) await animate(dragX, 600, { duration: 0.2 });

    try {
      const docRef = await addDoc(collection(db, "passes"), {
        fromUserId: loggedInUser.uid, toUserId: targetUser.id, timestamp: new Date()
      });
      setActionHistory(prev => [...prev, { index: currentIndex, docId: docRef.id, collectionName: "passes" }]);
      dragX.set(0); dragY.set(0); advanceCard();
    } catch (error) {}
  };

  const handleLike = async () => {
    const targetUser = users[currentIndex];
    const loggedInUser = auth.currentUser;
    if (!loggedInUser || !targetUser) return;
    if (dragX.get() > -100) await animate(dragX, -600, { duration: 0.2 });

    try {
      const matchQuery = query(collection(db, "likes"), where("fromUserId", "==", targetUser.id), where("toUserId", "==", loggedInUser.uid));
      const matchSnapshot = await getDocs(matchQuery);

      if (!matchSnapshot.empty) {
        const chatId = loggedInUser.uid < targetUser.id ? `${loggedInUser.uid}_${targetUser.id}` : `${targetUser.id}_${loggedInUser.uid}`;
        await setDoc(doc(db, "chats", chatId), { users: [loggedInUser.uid, targetUser.id], createdAt: new Date() }, { merge: true });
        setMatchData({ targetUser, chatId });
      } else {
        const docRef = await addDoc(collection(db, "likes"), {
          fromUserId: loggedInUser.uid, toUserId: targetUser.id, timestamp: new Date()
        });
        setActionHistory(prev => [...prev, { index: currentIndex, docId: docRef.id, collectionName: "likes" }]);
      }
      dragX.set(0); dragY.set(0); advanceCard();
    } catch (error) {}
  };

  const handleSuperLike = async () => {
    if (userData?.role !== "admin" && userData?.role !== "vip") {
      setShowPlans(true); return;
    }
    const targetUser = users[currentIndex];
    const loggedInUser = auth.currentUser;
    if (!loggedInUser || !targetUser) return;
    if (dragY.get() > -100) await animate(dragY, -800, { duration: 0.2 });

    try {
      const chatId = loggedInUser.uid < targetUser.id ? `${loggedInUser.uid}_${targetUser.id}` : `${targetUser.id}_${loggedInUser.uid}`;
      await setDoc(doc(db, "chats", chatId), { users: [loggedInUser.uid, targetUser.id], createdAt: new Date() }, { merge: true });
      dragX.set(0); dragY.set(0); router.push(`/chat/${chatId}`);
    } catch (error) {}
  };

  const handleDragEnd = async (event: any, info: PanInfo) => {
    const threshold = 120; 
    if (info.offset.x > threshold) {
      await animate(dragX, 600, { duration: 0.2 }); handlePass();
    } else if (info.offset.x < -threshold) {
      await animate(dragX, -600, { duration: 0.2 }); handleLike();
    } else if (info.offset.y < -threshold) {
      await animate(dragY, -800, { duration: 0.2 }); handleSuperLike(); 
    }
  };

  const handleTap = (e: React.MouseEvent, direction: "next" | "prev", maxPhotos: number) => {
    if (direction === "next" && currentPhotoIndex < maxPhotos - 1) setCurrentPhotoIndex(prev => prev + 1);
    else if (direction === "prev" && currentPhotoIndex > 0) setCurrentPhotoIndex(prev => prev - 1);
  };

  const handleSelectPlan = async (planName: string) => {
      if (!auth.currentUser) return;
      setProcessingPayment(true);
      const daysMap: { [key: string]: number } = { "شهر واحد": 30, "3 أشهر": 90, "سنة كاملة": 365 };
      const endDate = new Date(); endDate.setDate(endDate.getDate() + (daysMap[planName] || 30));
  
      setTimeout(async () => {
        try {
          await updateDoc(doc(db, "users", auth.currentUser!.uid), { role: "vip", planName, startDate: new Date(), endDate });
          setUserData((prev: any) => ({ ...prev, role: "vip", endDate }));
          setProcessingPayment(false); setShowPlans(false);
          alert(`مبروك! اشتراكك فعال لغاية: ${endDate.toLocaleDateString('ar-IQ')} ⭐`);
        } catch (error) { setProcessingPayment(false); }
      }, 2000);
  };

  if (loading) return <div className="h-[100dvh] bg-black flex items-center justify-center text-white"><span className="animate-pulse">جاري البحث... 🔍</span></div>;

  const displayedUser = users[currentIndex];
  const nextUser = users[currentIndex + 1];

  const UndoIcon = () => (<svg className="w-6 h-6 text-amber-500 drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>);
  const PassIcon = () => (<svg className="w-8 h-8 text-red-500 drop-shadow-md" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>);
  const SuperLikeIcon = () => (<svg className="w-7 h-7 text-blue-500 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>);
  const LikeIcon = () => (<svg className="w-9 h-9 text-green-500 drop-shadow-md" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>);
  const VerifiedBadge = () => (<svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 mr-1" xmlns="http://www.w3.org/2000/svg"><path d="M11.602 1.672a.846.846 0 0 1 .796 0l2.35 1.355a.846.846 0 0 0 .584.113l2.67-.478a.846.846 0 0 1 .971.606l.847 2.585a.846.846 0 0 0 .426.495l2.482.977a.846.846 0 0 1 .531.999l-.865 2.613a.846.846 0 0 0 .092.583l1.528 2.235a.846.846 0 0 1-.223 1.12l-2.185 1.705a.846.846 0 0 0-.295.513l-.364 2.705a.846.846 0 0 1-1.042.721l-2.684-.523a.846.846 0 0 0-.584.148l-2.222 1.608a.846.846 0 0 1-1.114-.047l-1.922-1.916a.846.846 0 0 0-.57-.234l-2.735.034a.846.846 0 0 1-.856-.84l-.034-2.736a.846.846 0 0 0-.234-.57l-1.916-1.92a.846.846 0 0 1-.047-1.115l1.608-2.221a.846.846 0 0 0 .148-.584l-.523-2.685a.846.846 0 0 1 .72-1.042l2.705-.364a.846.846 0 0 0 .513-.295l1.705-2.185a.846.846 0 0 1 1.12-.223l2.235 1.528a.846.846 0 0 0 .583.092l2.613-.865a.846.846 0 0 1 .999.53l.977 2.483a.846.846 0 0 0 .495.426l2.585.847a.846.846 0 0 1 .606.971l-.478 2.67a.846.846 0 0 0 .113.584l1.355 2.35z" fill="#3B82F6"/><path d="M10.5 15.5l-3-3 1.414-1.414L10.5 12.672l5.086-5.086L17 9l-6.5 6.5z" fill="white"/></svg>);

  return (
    <div className="h-[100dvh] w-full bg-black flex flex-col font-sans text-white overflow-hidden relative" dir="rtl">
      
      <div className="absolute top-0 inset-x-0 h-24 flex justify-between items-center px-6 z-20 bg-linear-to-b from-black/90 via-black/50 to-transparent pointer-events-none">
        <div className="flex items-center pointer-events-auto cursor-pointer group" onClick={() => router.push("/")}>
          <h1 className="text-4xl font-medium text-transparent bg-clip-text bg-linear-to-br from-indigo-400 via-pink-500 to-rose-500 drop-shadow-[0_2px_10px_rgba(236,72,153,0.3)] tracking-wide group-hover:scale-105 transition-transform" style={{ fontFamily: "'Calibri', sans-serif" }}>ديرة</h1>
        </div>
        <div onClick={() => router.push("/notifications")} className="w-11 h-11 bg-white/10 backdrop-blur-md border border-white/20 rounded-full flex items-center justify-center cursor-pointer relative shadow-[0_4px_15px_rgba(0,0,0,0.5)] pointer-events-auto hover:bg-white/20 transition-colors">
          <svg className="w-5 h-5 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
          {hasNotifications && <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-black animate-bounce"></span>}
        </div>
      </div>

      {!showFullProfile && (
        <div className="flex-1 flex flex-col w-full pt-20 pb-2">
          <div className="flex-1 w-full relative flex items-center justify-center">
            {!displayedUser ? (
              <div className="flex flex-col items-center justify-center text-center p-6">
                <div className="text-6xl mb-4">🏜️</div>
                <h2 className="text-2xl font-bold mb-2">لا يوجد المزيد</h2>
                <button onClick={() => window.location.reload()} className="bg-indigo-600 px-8 py-3 rounded-full mt-4 font-bold shadow-lg cursor-pointer">تحديث</button>
              </div>
            ) : (
              <>
                {nextUser && (
                  <div className="absolute w-[95%] max-w-md h-[95%] bg-gray-950 overflow-hidden shadow-md rounded-3xl opacity-40 scale-95 transform translate-y-4 pointer-events-none">
                    {nextUser.photos && nextUser.photos.length > 0 ? (
                      <img src={nextUser.photos[0]} className="w-full h-full object-cover blur-xs" />
                    ) : (
                      <div className="w-full h-full bg-linear-to-tr from-gray-900 to-indigo-950 flex items-center justify-center text-7xl font-bold text-white/10">{nextUser.name ? nextUser.name[0] : "?"}</div>
                    )}
                  </div>
                )}

                <motion.div 
                  key={displayedUser.id} 
                  style={{ x: dragX, y: dragY, rotate: rotate }}
                  drag dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }} onDragEnd={handleDragEnd} whileDrag={{ scale: 1.02 }}
                  className="absolute w-[95%] max-w-md h-[95%] bg-gray-900 overflow-hidden shadow-2xl rounded-3xl cursor-grab active:cursor-grabbing z-10 border border-white/5"
                >
                  <motion.div style={{ opacity: passOpacity }} className="absolute top-16 left-6 z-50 transform -rotate-12 border-4 border-red-500 rounded-xl px-4 py-2 text-red-500 font-black text-5xl bg-black/50 backdrop-blur-xs shadow-2xl pointer-events-none">رفض</motion.div>
                  <motion.div style={{ opacity: likeOpacity }} className="absolute top-16 right-6 z-50 transform rotate-12 border-4 border-green-500 rounded-xl px-4 py-2 text-green-500 font-black text-5xl bg-black/50 backdrop-blur-xs shadow-2xl pointer-events-none">إعجاب</motion.div>
                  <motion.div style={{ opacity: superLikeOpacity }} className="absolute bottom-1/2 translate-y-1/2 left-1/2 -translate-x-1/2 z-50 border-4 border-blue-500 rounded-xl px-6 py-2 text-blue-500 font-black text-4xl bg-black/50 backdrop-blur-xs shadow-2xl pointer-events-none whitespace-nowrap">⭐ رسالة</motion.div>

                  {displayedUser.photos && displayedUser.photos.length > 0 && (
                    <div className="absolute top-4 left-4 right-4 flex gap-1 z-20" dir="ltr">
                      {displayedUser.photos.map((_: any, idx: number) => (
                        <div key={idx} className={`h-1 flex-1 rounded-full ${idx === currentPhotoIndex ? "bg-white shadow-[0_0_5px_white]" : "bg-white/30"}`} />
                      ))}
                    </div>
                  )}

                  <img src={displayedUser.photos[currentPhotoIndex]} className="w-full h-full object-cover pointer-events-none" />
                  
                  <div className="absolute inset-0 flex z-10 pt-10">
                    <div className="w-1/2 h-full" onClick={(e) => handleTap(e, "prev", displayedUser.photos?.length || 1)} />
                    <div className="w-1/2 h-full" onClick={(e) => handleTap(e, "next", displayedUser.photos?.length || 1)} />
                  </div>

                  <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent pointer-events-none z-10" />
                  
                  <div className="absolute bottom-6 left-6 right-6 z-20 pointer-events-none flex justify-between items-end">
                    <div className="flex flex-col pointer-events-auto">
                      <h2 className="text-3xl font-black mb-1 flex items-center drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                        {displayedUser.name} <span className="text-2xl font-medium text-gray-200 mr-2">{displayedUser.age}</span>
                        {displayedUser.photos?.length > 0 && <VerifiedBadge />}
                      </h2>
                      <div className="flex flex-col text-gray-200 text-sm drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] font-medium">
                        {displayedUser.city && <span>📍 {displayedUser.city}</span>}
                        {displayedUser.job && <span>💼 {displayedUser.job}</span>}
                      </div>
                    </div>

                    <button 
                      onClick={() => setShowFullProfile(true)} 
                      className="pointer-events-auto w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/30 flex items-center justify-center text-white font-bold text-xl hover:bg-black/60 transition shadow-[0_4px_10px_rgba(0,0,0,0.5)] cursor-pointer"
                    >
                      !
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </div>

          {displayedUser && (
            <div className="h-24 shrink-0 flex justify-center items-center gap-5 z-30 px-4">
              <button onClick={handleUndo} className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 shadow-[inset_0_-4px_0_rgba(245,158,11,0.5),0_10px_15px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[inset_0_-1px_0_rgba(245,158,11,0.5),0_5px_8px_rgba(0,0,0,0.5)] transition-all duration-150 cursor-pointer"><UndoIcon /></button>
              <button onClick={handlePass} className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 shadow-[inset_0_-4px_0_rgba(239,68,68,0.5),0_10px_15px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[inset_0_-1px_0_rgba(239,68,68,0.5),0_5px_8px_rgba(0,0,0,0.5)] transition-all duration-150 cursor-pointer"><PassIcon /></button>
              <button onClick={handleSuperLike} className="w-14 h-14 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 shadow-[inset_0_-4px_0_rgba(59,130,246,0.5),0_10px_15px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[inset_0_-1px_0_rgba(59,130,246,0.5),0_5px_8px_rgba(0,0,0,0.5)] transition-all duration-150 cursor-pointer relative"><SuperLikeIcon /></button>
              <button onClick={handleLike} className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 shadow-[inset_0_-4px_0_rgba(34,197,94,0.5),0_10px_15px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[inset_0_-1px_0_rgba(34,197,94,0.5),0_5px_8px_rgba(0,0,0,0.5)] transition-all duration-150 cursor-pointer"><LikeIcon /></button>
            </div>
          )}
        </div>
      )}

      {!showFullProfile && (
        <div className="h-[75px] shrink-0 bg-black/90 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-4 pb-2 z-40 w-full">
          <button className="flex flex-col items-center gap-1 text-pink-500 transition-transform active:scale-95 cursor-pointer"><span className="text-2xl drop-shadow-[0_0_10px_rgba(236,72,153,0.5)]">🔥</span><span className="text-xs font-bold">استكشف</span></button>
          <button onClick={() => router.push("/messages")} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition-transform active:scale-95 cursor-pointer"><span className="text-2xl">💬</span><span className="text-xs font-bold">الرسائل</span></button>        
          <button onClick={() => router.push("/profile")} className="flex flex-col items-center gap-1 text-gray-500 hover:text-gray-300 transition-transform active:scale-95 cursor-pointer"><span className="text-2xl">⚙️</span><span className="text-xs font-bold">حسابي</span></button>
        </div>
      )}

      {/* 🌟 شاشة البروفايل الكامل التفصيلية بنفس ترتيب الصفحة الشخصية 🌟 */}
      {showFullProfile && displayedUser && (
        <div className="absolute inset-0 bg-gray-950 z-50 overflow-y-auto pb-32 animate-in slide-in-from-bottom flex flex-col">
          <button onClick={() => setShowFullProfile(false)} className="absolute top-6 right-6 z-50 w-12 h-12 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center text-xl border border-white/20 cursor-pointer shadow-lg text-white">🔽</button>
          
          <div className="w-full h-[60vh] shrink-0 relative">
            <img src={displayedUser.photos[currentPhotoIndex]} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-gray-950 via-transparent to-transparent"></div>
          </div>
          
          <div className="px-6 -mt-10 relative z-10 shrink-0">
            <h1 className="text-4xl font-black mb-2 flex items-center">
              {displayedUser.name} <span className="font-light text-gray-400 mr-2">{displayedUser.age}</span>
              {displayedUser.photos?.length > 0 && <VerifiedBadge />}
            </h1>
            <p className="text-gray-300 text-lg mb-6">📍 {displayedUser.city} {displayedUser.job ? `• 💼 ${displayedUser.job}` : ""}</p>
            
            <div className="w-full h-px bg-white/10 mb-6"></div>

            {/* قسم عنّي */}
            {displayedUser.bio && (
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-3 text-pink-400">عنّي 📝</h3>
                <p className="bg-white/5 border border-white/5 p-4 rounded-2xl text-gray-300 leading-relaxed text-sm shadow-inner break-words">
                  {displayedUser.bio}
                </p>
              </div>
            )}

            {/* قسم أبحث عن */}
            {displayedUser.lookingFor && (
              <div className="mb-6">
                <h3 className="text-xl font-bold mb-3 text-emerald-400">أبحث عن 🔍</h3>
                <p className="bg-white/5 border border-white/5 p-4 rounded-2xl text-gray-300 leading-relaxed text-sm shadow-inner break-words">
                  {displayedUser.lookingFor}
                </p>
              </div>
            )}

            {/* قسم تفاصيل عامة */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-3 text-indigo-400">تفاصيل عامة 👤</h3>
              <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                <ProfileRow label="الجنس" value={displayedUser.gender} />
                <ProfileRow label="الاسم" value={displayedUser.name} />
                <ProfileRow label="العمر" value={displayedUser.age ? `${displayedUser.age} سنة` : null} />
                <ProfileRow label="العنوان" value={displayedUser.city} />
                <ProfileRow label="البرج" value={displayedUser.zodiac} />
              </div>
            </div>

            {/* قسم المزيد عنّي */}
            <div className="mb-8">
              <h3 className="text-xl font-bold mb-3 text-amber-400">المزيد عنّي 📋</h3>
              <div className="bg-white/5 rounded-3xl border border-white/10 overflow-hidden">
                <ProfileRow label="الطول" value={displayedUser.height ? `${displayedUser.height} سم` : null} />
                <ProfileRow label="الحالة" value={displayedUser.maritalStatus} />
                <ProfileRow label="الشهادة" value={displayedUser.education} />
                <ProfileRow label="اللغات" value={displayedUser.languages} />
                <ProfileRow label="الوظيفة" value={displayedUser.job} />
              </div>
            </div>

          </div>

          {/* أزرار التفاعل السفلية داخل البروفايل */}
          <div className="fixed bottom-0 inset-x-0 p-6 bg-linear-to-t from-gray-950 via-gray-950/90 to-transparent flex justify-center gap-6 z-50">
            <button onClick={handlePass} className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 shadow-[inset_0_-4px_0_rgba(239,68,68,0.5),0_10px_15px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[inset_0_-1px_0_rgba(239,68,68,0.5),0_5px_8px_rgba(0,0,0,0.5)] transition-all">
              <PassIcon />
            </button>
            <button onClick={handleSuperLike} className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 shadow-[inset_0_-4px_0_rgba(59,130,246,0.5),0_10px_15px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[inset_0_-1px_0_rgba(59,130,246,0.5),0_5px_8px_rgba(0,0,0,0.5)] transition-all">
              <SuperLikeIcon />
            </button>
            <button onClick={handleLike} className="w-16 h-16 rounded-full flex items-center justify-center bg-gray-800 border border-gray-700 shadow-[inset_0_-4px_0_rgba(34,197,94,0.5),0_10px_15px_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-[inset_0_-1px_0_rgba(34,197,94,0.5),0_5px_8px_rgba(0,0,0,0.5)] transition-all">
              <LikeIcon />
            </button>
          </div>
        </div>
      )}

      {/* شاشة التوافق والباقات */}
      {matchData && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-linear-to-r from-pink-500 to-amber-500 mb-8 drop-shadow-2xl animate-bounce">حصل توافق! 🎉</h1>
          <p className="text-lg text-gray-300 mb-10">أنت و {matchData.targetUser.name} معجبان ببعضكما!</p>
          <div className="flex gap-4 mb-12">
            <img src={userData?.photoURL || userData?.photos?.[0]} className="w-28 h-28 rounded-full border-4 border-pink-500 object-cover shadow-[0_0_30px_rgba(236,72,153,0.5)]" />
            <img src={matchData.targetUser.photos?.[0] || ""} className="w-28 h-28 rounded-full border-4 border-indigo-500 object-cover shadow-[0_0_30px_rgba(99,102,241,0.5)]" />
          </div>
          <button onClick={() => router.push(`/chat/${matchData.chatId}`)} className="w-full max-w-xs bg-linear-to-r from-pink-600 to-indigo-600 font-bold py-4 rounded-full shadow-lg mb-4 text-lg hover:scale-105 transition cursor-pointer">مراسلة الآن 💬</button>
          <button onClick={() => { setMatchData(null); advanceCard(); }} className="w-full max-w-xs bg-transparent border border-white/20 font-bold py-4 rounded-full text-gray-300 hover:bg-white/10 transition cursor-pointer">متابعة التصفح</button>
        </div>
      )}

      {showPlans && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-white/10 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl flex flex-col">
            <button onClick={() => setShowPlans(false)} className="absolute top-4 left-4 text-gray-400 hover:text-white cursor-pointer">❌</button>
            <h2 className="text-2xl font-black text-center mb-2 mt-4 text-transparent bg-clip-text bg-linear-to-r from-amber-400 to-amber-600">ترقية للـ VIP ⭐</h2>
            <p className="text-gray-400 text-center text-sm mb-6">احصل على وصول غير محدود وإرسال خاص مباشر</p>
            <div className="space-y-3">
              <button onClick={() => handleSelectPlan("شهر واحد")} disabled={processingPayment} className="w-full border border-amber-600/30 hover:border-amber-500 bg-gray-800 rounded-2xl p-4 flex justify-between items-center transition cursor-pointer disabled:opacity-50">
                <div className="text-right"><h3 className="font-bold text-lg text-gray-200">شهر واحد</h3></div><div className="font-black text-xl text-amber-500">10$</div>
              </button>
              <button onClick={() => handleSelectPlan("3 أشهر")} disabled={processingPayment} className="w-full border border-amber-600/30 hover:border-amber-500 bg-gray-800 rounded-2xl p-4 flex justify-between items-center transition cursor-pointer disabled:opacity-50">
                <div className="text-right"><h3 className="font-bold text-lg text-gray-200">3 أشهر</h3></div><div className="font-black text-xl text-amber-500">25$</div>
              </button>
              <button onClick={() => handleSelectPlan("سنة كاملة")} disabled={processingPayment} className="w-full border border-amber-600/30 hover:border-amber-500 bg-gray-800 rounded-2xl p-4 flex justify-between items-center transition cursor-pointer disabled:opacity-50">
                <div className="text-right"><h3 className="font-bold text-lg text-gray-200">سنة كاملة</h3></div><div className="font-black text-xl text-amber-500">60$</div>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ================= Component لعرض الصفوف داخل البروفايل =================
// هذه الدالة تخفي السطر تلقائياً إذا كان الحقل فارغاً
function ProfileRow({ label, value }: { label: string, value: any }) {
  if (!value) return null; // إخفاء الحقل إذا لم يكتبه المستخدم
  return (
    <div className="flex justify-between items-center p-4 border-b border-white/5 last:border-0 bg-transparent">
      <span className="text-gray-400 font-medium text-sm">{label}</span>
      <span className="text-gray-100 font-bold text-sm truncate max-w-[60%] text-left">{value}</span>
    </div>
  );
}