"""
Service for managing chat history persistence.
"""
import json
import os
from typing import List, Dict, Any
from datetime import datetime

class ChatManager:
    def __init__(self):
        self.current_session_id: Dict[str, str] = {}  # Track current session per bucket

    def _get_active_session_file(self, bucket_name: str) -> str:
        """Find the latest session file or create new one."""
        from services.minio_service import minio_service
        
        # List all Chat sessions
        try:
            sessions = minio_service.list_objects(bucket_name, prefix="chats/session")
            # Expected format: chats/session1.json, chats/session2.json
            
            if not sessions:
                return "chats/session1.json"
            
            # Extract numbers
            max_id = 0
            for s in sessions:
                try:
                    # s might be "chats/session1.json"
                    fname = s.split("/")[-1] # session1.json
                    base = fname.replace("session", "").replace(".json", "")
                    sid = int(base)
                    if sid > max_id:
                        max_id = sid
                except:
                    continue
            
            # For now, let's keep appending to the latest session? 
            # Or does the user want NEW sessions? 
            # User said: "Each session{NUMBER}.json is created when a new chat session is created."
            # But the UI doesn't have a "New Session" button explicitly connected to backend yet logic wise...
            # The current UI usually clears history or continues.
            # To support "Resume", we usually pick the last one.
            # To support "New", we'd increment.
            # Since I don't see a "Session ID" passed from frontend `save_message`, I'll default to:
            # - If history is empty/new request, maybe just use latest.
            # But to fulfill "chat history persistence", we probably just want to read the LATEST session by default.
            # If the user clears history, we effectively start a new session?
            
            return f"chats/session{max_id}.json" if max_id > 0 else "chats/session1.json"

        except Exception:
            return "chats/session1.json"
            
    def create_new_session(self, bucket_name: str) -> str:
        """Force create a new session ID."""
        from services.minio_service import minio_service
        sessions = minio_service.list_objects(bucket_name, prefix="chats/session")
        max_id = 0
        for s in sessions:
            try:
                fname = s.split("/")[-1]
                base = fname.replace("session", "").replace(".json", "")
                sid = int(base)
                if sid > max_id:
                    max_id = sid
            except: pass
        
        return f"chats/session{max_id + 1}.json"

    def list_sessions(self, bucket_name: str) -> List[Dict[str, Any]]:
        """List all chat sessions for a bucket."""
        from services.minio_service import minio_service
        
        try:
            sessions = minio_service.list_objects(bucket_name, prefix="chats/session")
            session_list = []
            
            for s in sessions:
                try:
                    fname = s.split("/")[-1]  # session1.json
                    base = fname.replace("session", "").replace(".json", "")
                    session_id = int(base)
                    session_list.append({
                        "id": session_id,
                        "name": f"Session {session_id}",
                        "file": s
                    })
                except:
                    continue
            
            # Sort by ID descending (newest first)
            session_list.sort(key=lambda x: x["id"], reverse=True)
            return session_list
        except Exception as e:
            print(f"Error listing sessions: {e}")
            return []
    
    def load_session(self, bucket_name: str, session_id: int) -> List[Dict[str, Any]]:
        """Load a specific chat session."""
        from services.minio_service import minio_service
        
        session_file = f"chats/session{session_id}.json"
        self.current_session_id[bucket_name] = session_file
        
        data = minio_service.get_json(bucket_name, session_file)
        return data if isinstance(data, list) else []
    
    def get_history(self, bucket_name: str, session_id: int = None) -> List[Dict[str, Any]]:
        """Load chat history for the active or specified session."""
        from services.minio_service import minio_service
        
        if session_id is not None:
            return self.load_session(bucket_name, session_id)
        
        # Use current session or get active
        if bucket_name in self.current_session_id:
            session_file = self.current_session_id[bucket_name]
        else:
            session_file = self._get_active_session_file(bucket_name)
            self.current_session_id[bucket_name] = session_file
        
        data = minio_service.get_json(bucket_name, session_file)
        return data if isinstance(data, list) else []

    def save_message(self, bucket_name: str, role: str, content: str, sources: List[dict] = None):
        """Append a message to the chat history."""
        from services.minio_service import minio_service
        
        # Use current session or get active
        if bucket_name in self.current_session_id:
            session_file = self.current_session_id[bucket_name]
        else:
            session_file = self._get_active_session_file(bucket_name)
            self.current_session_id[bucket_name] = session_file
        
        history = self.get_history(bucket_name)
        
        message = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if sources:
            message["sources"] = sources

        history.append(message)
        
        minio_service.put_json(bucket_name, session_file, history)

    def clear_history(self, bucket_name: str) -> int:
        """Start a new session (effectively 'clearing' by moving to next)."""
        from services.minio_service import minio_service
        
        new_file = self.create_new_session(bucket_name)
        minio_service.put_json(bucket_name, new_file, [])  # Initialize empty
        self.current_session_id[bucket_name] = new_file
        
        # Extract and return session ID
        fname = new_file.split("/")[-1]
        session_id = int(fname.replace("session", "").replace(".json", ""))
        return session_id
    
    def get_chat_stats(self, bucket_name: str) -> Dict[str, Any]:
        """Get chat statistics for a space."""
        from services.minio_service import minio_service
        
        try:
            sessions = self.list_sessions(bucket_name)
            total_sessions = len(sessions)
            total_messages = 0
            last_activity = None
            
            # Count messages across all sessions
            for session in sessions:
                try:
                    history = minio_service.get_json(bucket_name, session['file'])
                    if isinstance(history, list):
                        total_messages += len(history)
                        # Find last message timestamp
                        for msg in reversed(history):
                            if 'timestamp' in msg:
                                msg_time = msg['timestamp']
                                if last_activity is None or msg_time > last_activity:
                                    last_activity = msg_time
                                break
                except:
                    continue
            
            return {
                "total_sessions": total_sessions,
                "total_messages": total_messages,
                "last_activity": last_activity
            }
        except Exception as e:
            print(f"Error getting chat stats: {e}")
            return {
                "total_sessions": 0,
                "total_messages": 0,
                "last_activity": None
            }

chat_manager = ChatManager()