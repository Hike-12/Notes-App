from django.shortcuts import render
from django.http import JsonResponse
from .models import Note
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

# Create your views here.
def frontpage(request):
    notes = Note.objects.all()
    notes_list = list(notes.values('id', 'title', 'body'))
    return JsonResponse(notes_list, safe=False)

@csrf_exempt
@require_http_methods(["POST"])
def save_note(request):
    try:
        data = json.loads(request.body)  # Parse the entire JSON body
        note_content = data.get('content', '')
        note_title = data.get('title', '')
        
        if note_content:
            Note.objects.create(body=note_content, title=note_title)
            return JsonResponse({'status': 'success'}, status=201)
        
        return JsonResponse({'status': 'error', 'message': 'No content provided'}, status=400)
    
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    
