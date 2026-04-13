import os
import re
from langchain_chroma import Chroma
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import PromptTemplate
from app.core.config import settings

_embeddings = None
_vectorstore = None


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        try:
            from langchain_huggingface import HuggingFaceEmbeddings
            _embeddings = HuggingFaceEmbeddings(
                model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
                model_kwargs={"device": "cpu"}
            )
        except ImportError:
            from langchain_community.embeddings import FakeEmbeddings
            _embeddings = FakeEmbeddings(size=384)
    return _embeddings


def get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        _vectorstore = Chroma(
            persist_directory=settings.CHROMA_PERSIST_DIR,
            embedding_function=get_embeddings(),
            collection_name="pragati_knowledge"
        )
    return _vectorstore


def index_document(file_path: str, metadata: dict = None):
    if file_path.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    else:
        loader = TextLoader(file_path, encoding="utf-8")
    docs = loader.load()
    splitter = RecursiveCharacterTextSplitter(chunk_size=800, chunk_overlap=100)
    chunks = splitter.split_documents(docs)
    if metadata:
        for chunk in chunks:
            chunk.metadata.update(metadata)
    vs = get_vectorstore()
    vs.add_documents(chunks)
    return len(chunks)


def retrieve_context(query: str, k: int = 3) -> str:
    try:
        vs = get_vectorstore()
        docs = vs.similarity_search(query, k=k)
        return "\n\n".join([d.page_content for d in docs])
    except Exception:
        return ""


async def rag_query(question: str, language: str = "hi", history: list[dict] = None) -> str:
    from app.services.ai.llm_service import run_chain_with_tools, CHATBOT_SYSTEM_PROMPT

    use_rag = len(question.strip()) > 20 and any(kw in question.lower() for kw in [
        'fasal', 'crop', 'khet', 'mitti', 'soil', 'beej', 'seed', 'khad', 'fertilizer',
        'keeda', 'pest', 'rog', 'disease', 'sinchai', 'irrigation', 'mausam', 'weather',
        'mandi', 'price', 'bhav', 'gehu', 'wheat', 'dhan', 'rice', 'soybean', 'cotton',
        'scheme', 'yojana', 'loan', 'kisan', 'farmer', 'harvest', 'katai', 'buwai',
    ])

    context = retrieve_context(question, k=3) if use_rag else ""

    system = CHATBOT_SYSTEM_PROMPT.format(
        language=language,
        context=context or "Use your general agriculture knowledge."
    )

    # Pass conversation history for memory
    result = await run_chain_with_tools(system, question, history=history)
    result = re.sub(r'<think>.*?</think>', '', result, flags=re.DOTALL).strip()

    if not result or len(result) < 10:
        if language == 'hi':
            return "माफ करें, AI सेवा अभी उपलब्ध नहीं है। कृपया दोबारा प्रयास करें।"
        return "Sorry, the AI service is temporarily unavailable. Please try again."

    return result
