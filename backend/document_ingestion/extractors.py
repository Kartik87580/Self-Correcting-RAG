# document_ingestion/extractors.py
import os
import asyncio
from typing import Optional

# NOTE: Heavy imports (docling, crawl4ai, pymupdf4llm, groq) are lazy-loaded
# inside each function to avoid ~200MB RAM overhead at startup on Render.

from .utils import clean_text, to_markdown


def extract_pdf_pymupdf(file_path: str) -> str:
    """Uses pymupdf4llm to extract Markdown from a PDF."""
    import pymupdf4llm
    md_text = pymupdf4llm.to_markdown(file_path)
    return clean_text(md_text)


def extract_pdf_docling(file_path: str) -> str:
    """Uses docling for OCR PDFs and returns Markdown."""
    from docling.document_converter import DocumentConverter
    converter = DocumentConverter()
    result = converter.convert(file_path)
    md_text = result.document.export_to_markdown()
    return clean_text(md_text)


def extract_txt(file_path: str) -> str:
    """Reads a .txt file and converts it into Markdown text."""
    with open(file_path, "r", encoding="utf-8") as f:
        text = f.read()
    cleaned_txt = clean_text(text)
    title = os.path.basename(file_path)
    return to_markdown(title, cleaned_txt)


async def extract_webpage(url: str) -> str:
    """Crawls a webpage and returns its content as Markdown."""
    from crawl4ai import AsyncWebCrawler
    from bs4 import BeautifulSoup

    async with AsyncWebCrawler() as crawler:
        result = await crawler.arun(url=url)
        content = result.markdown
    return content


def extract_audio(file_path: str) -> str:
    """Uses Whisper (via Groq) to transcribe audio and return Markdown transcript."""
    from groq import Groq
    api_key = os.getenv("GROQ_API_KEY")
    client = Groq(api_key=api_key)

    with open(file_path, "rb") as file:
        transcription = client.audio.transcriptions.create(
            file=file,
            model="whisper-large-v3"
        )

    cleaned_txt = clean_text(transcription.text)
    title = os.path.basename(file_path)
    return to_markdown(title, cleaned_txt)


def extract_youtube(video_url: str) -> str:
    """Uses youtube-transcript-api to retrieve transcript and convert it into Markdown."""
    from youtube_transcript_api import YouTubeTranscriptApi

    if "v=" in video_url:
        video_id = video_url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in video_url:
        video_id = video_url.split("youtu.be/")[1].split("?")[0]
    else:
        video_id = video_url.replace("https://www.youtube.com/watch?v=", "")

    transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
    text = " ".join([entry["text"] for entry in transcript_data])

    cleaned_txt = clean_text(text)
    title = f"YouTube Transcript: {video_id}"
    return to_markdown(title, cleaned_txt)
