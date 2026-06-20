"use client";

import { useEffect, useState, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { Menu, X, Users, LogOut, Search, Plus } from "lucide-react";

interface Profile {
  id: string;
  nickname: string;
  avatar_url: string;
}

const AVATAR_OPTIONS = [
  { id: "explorer", icon: "🤠", label: "Explorer" },
  { id: "warrior", icon: "⚔️", label: "Warrior" },
  { id: "mage", icon: "🧙‍♂️", label: "Mage" },
  { id: "rogue", icon: "🥷", label: "Rogue" },
  { id: "healer", icon: "🧚‍♀️", label: "Healer" },
  { id: "bard", icon: "🎸", label: "Bard" },
  { id: "merchant", icon: "💰", label: "Merchant" },
  { id: "beast", icon: "🐺", label: "Beast" },
];

export default function Sidebar({ user }: { user: User }) {
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Edit state
  const [editNickname, setEditNickname] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [saving, setSaving] = useState(false);

  // Friendship state
  const [friends, setFriends] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Crew Member Profile Overlay state
  const [selectedCrewMember, setSelectedCrewMember] = useState<Profile | null>(null);

  const fetchFriends = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("friendships")
      .select("friend_id")
      .eq("user_id", user.id);
    
    if (data && !error && data.length > 0) {
      const friendIds = data.map((f) => f.friend_id);
      const { data: friendsData } = await supabase
        .from("profiles")
        .select("*")
        .in("id", friendIds);
      setFriends(friendsData || []);
    } else {
      setFriends([]);
    }
  }, [user, supabase]);

  useEffect(() => {
    async function fetchProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (data) {
        setProfile(data);
      } else if (error && error.code === "PGRST116") {
        // No profile found, let's upsert a default one
        const defaultProfile = {
          id: user.id,
          nickname: user.email?.split("@")[0] || "Wanderer",
          avatar_url: AVATAR_OPTIONS[Math.floor(Math.random() * AVATAR_OPTIONS.length)].icon,
        };
        const { data: newProfile, error: insertError } = await supabase
          .from("profiles")
          .upsert([defaultProfile])
          .select()
          .single();
        if (newProfile && !insertError) {
          setProfile(newProfile);
        }
      }
    }
    fetchProfile();
    fetchFriends();
  }, [user, supabase, fetchFriends]);

  const handleOpenEdit = () => {
    if (!profile) return;
    setEditNickname(profile.nickname);
    setEditAvatar(profile.avatar_url);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!profile || !editNickname.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({ nickname: editNickname.trim(), avatar_url: editAvatar })
      .eq("id", user.id)
      .select()
      .single();

    if (data && !error) {
      setProfile(data);
      setIsEditModalOpen(false);
    }
    setSaving(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .ilike("nickname", `%${searchQuery.trim()}%`)
      .neq("id", user.id)
      .limit(5);
    
    if (data && !error) {
      setSearchResults(data);
    } else {
      setSearchResults([]);
    }
    setIsSearching(false);
  };

  const handleAddFriend = async (friendId: string) => {
    const { error } = await supabase
      .from("friendships")
      .insert({ user_id: user.id, friend_id: friendId });
    
    if (!error || error.code === '23505') { // 23505 is unique violation, ignore if already friends
      fetchFriends();
      setSearchResults((prev) => prev.filter((p) => p.id !== friendId));
      setSearchQuery("");
    }
  };

  return (
    <>
      {/* Hamburger Button (Everywhere) */}
      <div className="fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 bg-[#fdfbf7] dark:bg-[#362d28] border-2 border-stone-800 dark:border-[#54463d] shadow-[3px_3px_0_#292524] dark:shadow-[3px_3px_0_#1e1815] text-stone-800 dark:text-[#fdfbf7] hover:bg-[#e8dcc4] dark:hover:bg-[#28211d] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
        >
          {isOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Overlay for Sidebar */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-72 flex flex-col bg-[#e8dcc4] dark:bg-[#28211d] border-r-4 border-stone-800 dark:border-[#54463d] shadow-[4px_0_0_rgba(0,0,0,0.5)] transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 border-b-4 border-stone-800 dark:border-[#54463d] bg-[#f4ecd8] dark:bg-[#362d28] text-center shrink-0 relative">
          <button 
            onClick={() => setIsOpen(false)} 
            className="absolute top-3 right-3 p-1 border-2 border-stone-800 dark:border-[#54463d] bg-[#fdfbf7] dark:bg-[#1e1815] text-stone-800 dark:text-[#fdfbf7] hover:bg-stone-200 dark:hover:bg-[#362d28] shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815] active:translate-x-px active:translate-y-px active:shadow-none"
          >
            <X size={16} />
          </button>
          <p className="font-pixel text-[8px] uppercase tracking-widest text-amber-700 dark:text-[#f5ebd5] mb-2 mt-2">
            ❖ Nomadic Journey ❖
          </p>
          <div 
            onClick={handleOpenEdit}
            className="mt-4 p-3 border-2 border-stone-400 border-dashed bg-[#fdfbf7] dark:bg-[#1e1815] dark:border-stone-600 hover:border-stone-800 dark:hover:border-stone-400 cursor-pointer transition-all group"
          >
            {profile ? (
              <div className="flex flex-col items-center">
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">
                  {profile.avatar_url}
                </div>
                <div className="font-mono text-xs font-bold text-stone-800 dark:text-[#fdfbf7]">
                  {profile.nickname}
                </div>
                <div className="font-pixel text-[8px] text-stone-500 mt-1 uppercase">Click to Edit</div>
              </div>
            ) : (
              <div className="animate-pulse flex flex-col items-center opacity-50">
                <div className="w-10 h-10 bg-stone-300 dark:bg-stone-700 mb-2"></div>
                <div className="w-16 h-3 bg-stone-300 dark:bg-stone-700"></div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Your Crew Section */}
          <div className="mb-6">
            <h3 className="font-pixel text-[9px] uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-3 px-2 flex items-center gap-2">
              <Users size={14} /> Your Crew
            </h3>
            
            {/* Global User Search Form */}
            <div className="flex items-center gap-2 mb-4 px-2">
              <input
                type="text"
                placeholder="Find member..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                className="flex-1 border-2 border-stone-400 bg-[#fdfbf7] px-2 py-1.5 font-mono text-[10px] text-stone-900 outline-none focus:border-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:border-stone-600"
              />
              <button
                onClick={handleSearch}
                disabled={isSearching}
                className="flex h-8 w-8 items-center justify-center border-2 border-stone-800 bg-[#f5eed7] text-stone-800 hover:bg-[#d8ccb4] dark:bg-[#362d28] dark:border-[#54463d] dark:text-[#fdfbf7] shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815] active:translate-x-px active:translate-y-px active:shadow-none"
              >
                <Search size={14} />
              </button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mb-4 px-2 space-y-2">
                <div className="font-pixel text-[7px] uppercase text-stone-500 mb-1 border-b border-stone-300 dark:border-stone-700 pb-1">Search Results</div>
                {searchResults.map(result => {
                  const isFriend = friends.some(f => f.id === result.id);
                  return (
                    <div key={result.id} className="flex items-center justify-between bg-[#fdfbf7] dark:bg-[#1e1815] border-2 border-stone-300 dark:border-stone-700 p-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{result.avatar_url}</span>
                        <span className="font-mono text-[10px] font-bold text-stone-800 dark:text-stone-200">{result.nickname}</span>
                      </div>
                      {!isFriend ? (
                        <button 
                          onClick={() => handleAddFriend(result.id)}
                          className="flex items-center gap-1 font-pixel text-[7px] uppercase bg-[#4a7c59] text-white px-2 py-1 border border-stone-800"
                        >
                          <Plus size={10} /> Add
                        </button>
                      ) : (
                        <span className="font-pixel text-[7px] uppercase text-stone-400">Added</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Active Friends List */}
            <div className="px-2 space-y-2">
              <div className="font-pixel text-[7px] uppercase text-stone-500 mb-1">Roster</div>
              {friends.length === 0 ? (
                <div className="p-3 border-2 border-stone-400 border-dashed bg-[#fdfbf7]/50 dark:bg-[#1e1815]/50 dark:border-stone-700 text-center">
                  <p className="font-mono text-[9px] text-stone-500">
                    No crew members yet. Search above to add friends!
                  </p>
                </div>
              ) : (
                friends.map((friend) => (
                  <button 
                    key={friend.id} 
                    onClick={() => setSelectedCrewMember(friend)}
                    className="w-full text-left flex items-center gap-3 p-2 bg-[#fdfbf7] dark:bg-[#1e1815] border-2 border-stone-400 dark:border-stone-600 shadow-[2px_2px_0_rgba(0,0,0,0.1)] hover:bg-[#f5eed7] dark:hover:bg-[#28211d] transition-colors cursor-pointer active:translate-x-px active:translate-y-px active:shadow-none"
                  >
                    <span className="text-2xl">{friend.avatar_url}</span>
                    <span className="font-mono text-xs font-bold text-stone-800 dark:text-stone-200">{friend.nickname}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </nav>

        <div className="p-4 border-t-4 border-stone-800 dark:border-[#54463d] shrink-0">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 border-2 border-stone-800 bg-[#fdfbf7] dark:bg-[#1e1815] dark:border-[#54463d] text-stone-800 dark:text-[#fdfbf7] font-pixel text-[9px] uppercase hover:bg-red-100 hover:text-red-800 hover:border-red-800 dark:hover:bg-red-900/30 dark:hover:text-red-300 dark:hover:border-red-800 transition-colors shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      </aside>

      {/* ── User Profile Overview Overlay Modal ──────────────────────────────── */}
      {selectedCrewMember && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedCrewMember(null)} />
          <div className="relative w-full max-w-sm border-4 border-stone-800 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d] shadow-[8px_8px_0_#292524] dark:shadow-[8px_8px_0_#1e1815] p-6 animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setSelectedCrewMember(null)} 
              className="absolute top-3 right-3 p-1 border-2 border-stone-800 dark:border-[#54463d] bg-[#fdfbf7] dark:bg-[#1e1815] text-stone-800 dark:text-[#fdfbf7] hover:bg-stone-200 dark:hover:bg-[#362d28] shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815] active:translate-x-px active:translate-y-px active:shadow-none"
            >
              <X size={16} />
            </button>
            <p className="font-pixel text-[10px] uppercase tracking-widest text-stone-800 dark:text-[#fdfbf7] mb-6 border-b-2 border-stone-300 dark:border-[#54463d] pb-2">
              👤 User Profile Overview :
            </p>

            <div className="flex flex-col items-center mb-6">
              <div className="text-6xl mb-3 border-4 border-stone-800 dark:border-[#54463d] bg-[#e8dcc4] dark:bg-[#362d28] p-4 shadow-[4px_4px_0_#292524] dark:shadow-[4px_4px_0_#1e1815]">
                {selectedCrewMember.avatar_url}
              </div>
              <h2 className="font-mono text-lg font-black text-stone-800 dark:text-[#fdfbf7]">
                {selectedCrewMember.nickname}
              </h2>
            </div>

            <div className="space-y-4">
              {/* Trips Joined Stat */}
              <div className="border-2 border-stone-400 dark:border-stone-600 bg-[#f4ecd8] dark:bg-[#1e1815] p-3 shadow-[2px_2px_0_#a8a29e] dark:shadow-[2px_2px_0_#1e1815]">
                <div className="font-pixel text-[8px] uppercase text-stone-500 dark:text-stone-400 mb-2">⚔️ Total Trips Joined :</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-stone-300 dark:bg-stone-700 border border-stone-400">
                    <div className="h-full bg-amber-500 w-[45%]"></div>
                  </div>
                  <span className="font-mono text-xs font-bold text-stone-800 dark:text-stone-200 tabular-nums">12</span>
                </div>
              </div>

              {/* Expense Summary Stat */}
              <div className="border-2 border-stone-400 dark:border-stone-600 bg-[#f4ecd8] dark:bg-[#1e1815] p-3 shadow-[2px_2px_0_#a8a29e] dark:shadow-[2px_2px_0_#1e1815]">
                <div className="font-pixel text-[8px] uppercase text-stone-500 dark:text-stone-400 mb-2">💰 Expense Summary Overview :</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-stone-600 dark:text-stone-400">Total Cleared</span>
                  <span className="font-mono text-xs font-bold text-green-700 dark:text-green-500 tabular-nums">+ 9,250 Gold</span>
                </div>
              </div>

              {/* Mastery Level Stat */}
              <div className="border-2 border-stone-400 dark:border-stone-600 bg-[#f4ecd8] dark:bg-[#1e1815] p-3 shadow-[2px_2px_0_#a8a29e] dark:shadow-[2px_2px_0_#1e1815]">
                <div className="font-pixel text-[8px] uppercase text-stone-500 dark:text-stone-400 mb-2">🌟 Mastery Level :</div>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-stone-600 dark:text-stone-400">Seasoned Nomad</span>
                  <span className="font-mono text-xs font-bold text-stone-800 dark:text-stone-200">LVL 24</span>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <div className="relative w-full max-w-sm border-4 border-stone-800 bg-[#fdfbf7] dark:border-[#54463d] dark:bg-[#28211d] shadow-[8px_8px_0_#292524] dark:shadow-[8px_8px_0_#1e1815] p-6">
            <h2 className="font-pixel text-sm uppercase text-stone-800 dark:text-[#fdfbf7] mb-4 text-center">Edit Identity</h2>
            
            <div className="space-y-5">
              <div>
                <label className="block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400 mb-2">Nickname</label>
                <input 
                  type="text" 
                  value={editNickname}
                  onChange={(e) => setEditNickname(e.target.value)}
                  className="w-full border-2 border-stone-400 bg-[#f4ecd8] px-3.5 py-2.5 font-mono text-sm text-stone-900 placeholder-stone-400 outline-none focus:border-stone-800 dark:bg-[#1e1815] dark:text-[#fdfbf7] dark:border-stone-600 dark:focus:border-stone-400"
                  placeholder="Your nickname..."
                />
              </div>

              <div>
                <label className="block font-pixel text-[8px] uppercase tracking-widest text-stone-600 dark:text-stone-400 mb-2">Avatar</label>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setEditAvatar(opt.icon)}
                      className={`flex flex-col items-center justify-center p-2 border-2 transition-all ${
                        editAvatar === opt.icon 
                          ? "border-stone-800 bg-[#e8dcc4] dark:border-stone-400 dark:bg-[#362d28] scale-105 shadow-[2px_2px_0_#292524] dark:shadow-[2px_2px_0_#1e1815]" 
                          : "border-stone-300 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-500 grayscale hover:grayscale-0"
                      }`}
                    >
                      <span className="text-2xl mb-1">{opt.icon}</span>
                      <span className="font-pixel text-[6px] uppercase tracking-widest">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="flex-1 py-2.5 font-pixel text-[10px] uppercase border-2 border-stone-800 bg-[#e8dcc4] text-stone-800 dark:bg-[#362d28] dark:border-[#54463d] dark:text-[#fdfbf7]"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="flex-1 py-2.5 font-pixel text-[10px] uppercase bg-[#4a7c59] text-white disabled:opacity-50 border-2 border-[#1e3b26]"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
