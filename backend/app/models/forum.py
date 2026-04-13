from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime, Boolean, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class ForumPost(Base):
    __tablename__ = "forum_posts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    image_url = Column(String(255), nullable=True)
    category = Column(String(50), nullable=True)
    tags = Column(JSON, nullable=True)
    is_approved = Column(Boolean, default=True)
    is_flagged = Column(Boolean, default=False)
    ai_suggestion = Column(Text, nullable=True)
    upvotes = Column(Integer, default=0)
    language = Column(String(10), default="hi")
    created_at = Column(DateTime, server_default=func.now())


class ForumComment(Base):
    __tablename__ = "forum_comments"

    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(Integer, ForeignKey("forum_posts.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    is_approved = Column(Boolean, default=True)
    is_ai_generated = Column(Boolean, default=False)
    upvotes = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=func.now())


class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    session_id = Column(String(100), nullable=False)
    role = Column(String(10), nullable=False)  # user / assistant
    content = Column(Text, nullable=False)
    language = Column(String(10), default="hi")
    created_at = Column(DateTime, server_default=func.now())


class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    file_url = Column(String(255), nullable=False)
    doc_type = Column(String(50), nullable=True)
    language = Column(String(10), default="hi")
    is_indexed = Column(Boolean, default=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
