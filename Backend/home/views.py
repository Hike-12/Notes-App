from django.shortcuts import render,get_object_or_404
from django.http import JsonResponse
from .models import Note
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json

# Create your views here.
def sidebar(request):
    notes = Note.objects.all()
    notes_list = list(notes.values('id', 'title', 'body'))
    return JsonResponse(notes_list, safe=False)

@csrf_exempt
@require_http_methods(["GET"])
def get_note(request, id):
    try:
        note = get_object_or_404(Note, id=id)
        note_data = {
            'id': note.id,
            'title': note.title,
            'body': note.body,
        }
        return JsonResponse(note_data, status=200)
    except Note.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Note not found'}, status=404)
    
@csrf_exempt
@require_http_methods(["POST"])
def save_note(request):
    try:
        data = json.loads(request.body)  # Parse the entire JSON body
        note_content = data.get('content', '')
        note_title = data.get('title', '')
        note_id = data.get('id', None)
        
        if note_id:
            note = Note.objects.get(id=note_id)
            note.body = note_content
            note.title = note_title
            note.save()
        else:
            Note.objects.create(body=note_content, title=note_title)
        
        return JsonResponse({'status': 'success'}, status=201)
    
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    except Note.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Note not found'}, status=404)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_note(request, id):
    try:
        note = get_object_or_404(Note, id=id)
        note.delete()
        return JsonResponse({'status': 'success'}, status=200)
    except Note.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Note not found'}, status=404)
