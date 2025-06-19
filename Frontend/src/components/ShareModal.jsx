import React, { useState, useEffect } from 'react';

export default function ShareModal({ isOpen, onClose, note, onShareUpdate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPermission, setSelectedPermission] = useState('view');
  const [loading, setLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  // Move the useEffect hook here (before the conditional return)
  useEffect(() => {
    const searchUsers = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`http://localhost:8000/api/auth/search-users/?q=${encodeURIComponent(searchTerm)}`, {
          credentials: 'include'
        });
        const data = await response.json();
        setSearchResults(data.users || []);
      } catch (error) {
        console.error('User search failed:', error);
      } finally {
        setLoading(false);
      }
    };

    // Only run search if modal is open
    if (!isOpen) return;

    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, isOpen]); // Added isOpen as dependency

  // Now the conditional return comes AFTER all hooks
  if (!isOpen || !note) return null;

  const handleShare = async (user) => {
    setShareLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/share-note/${note.id}/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          username: user.username,
          permission: selectedPermission
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        onShareUpdate && onShareUpdate();
        setSearchTerm('');
        setSearchResults([]);
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Share failed:', error);
      alert('Failed to share note');
    } finally {
      setShareLoading(false);
    }
  };

  const handleRevokeShare = async (shareId) => {
    if (!confirm('Are you sure you want to revoke access?')) return;

    try {
      const response = await fetch(`http://localhost:8000/api/revoke-share/${note.id}/${shareId}/`, {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        onShareUpdate && onShareUpdate();
      } else {
        alert(data.message);
      }
    } catch (error) {
      console.error('Revoke failed:', error);
      alert('Failed to revoke access');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-[#3B3B1A]">Share Note</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search Users */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share with user
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by username..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8A784E]"
              />
              <select
                value={selectedPermission}
                onChange={(e) => setSelectedPermission(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#8A784E]"
              >
                <option value="view">View Only</option>
                <option value="edit">Can Edit</option>
              </select>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {searchResults.map((user) => (
                  <div key={user.id} className="p-3 hover:bg-gray-50 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{user.username}</div>
                      <div className="text-sm text-gray-500">
                        {user.first_name} {user.last_name}
                      </div>
                    </div>
                    <button
                      onClick={() => handleShare(user)}
                      disabled={shareLoading}
                      className="bg-[#8A784E] hover:bg-[#3B3B1A] text-white px-3 py-1 rounded text-sm transition-colors disabled:opacity-50"
                    >
                      Share
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Current Shares */}
          <div>
            <h3 className="text-lg font-semibold text-[#3B3B1A] mb-3">
              Shared with ({note.shares?.length || 0})
            </h3>
            
            {note.shares && note.shares.length > 0 ? (
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {note.shares.map((share) => (
                  <div key={share.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium">{share.user.username}</div>
                      <div className="text-sm text-gray-500">
                        {share.user.first_name} {share.user.last_name}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {share.permission === 'edit' ? 'Can edit' : 'View only'} • 
                        Shared {new Date(share.shared_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeShare(share.id)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                This note hasn't been shared with anyone yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}