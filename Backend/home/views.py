from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from .models import Note, Collaborator
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
import json

# Create your views here.
def sidebar(request):
    notes = Note.objects.all().order_by('-last_modified')
    notes_list = []
    for note in notes:
        collaborator_count = note.collaborators.filter(is_active=True).count()
        notes_list.append({
            'id': note.id,
            'title': note.title,
            'body': note.body,
            'collaborators': collaborator_count,
            'last_modified': note.last_modified.isoformat()
        })
    return JsonResponse(notes_list, safe=False)

@csrf_exempt
@require_http_methods(["GET"])
def get_note(request, id):
    try:
        note = get_object_or_404(Note, id=id)
        collaborators = note.collaborators.filter(is_active=True)
        note_data = {
            'id': note.id,
            'title': note.title,
            'body': note.body,
            'collaborators': [
                {
                    'user_identifier': collab.user_identifier,
                    'user_name': collab.user_name,
                    'color': collab.color
                } for collab in collaborators
            ]
        }
        return JsonResponse(note_data, status=200)
    except Note.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Note not found'}, status=404)

@csrf_exempt
@require_http_methods(["POST"])
def save_note(request):
    try:
        data = json.loads(request.body)
        note_content = data.get('content', '')
        note_title = data.get('title', '')
        note_id = data.get('id', None)
        
        channel_layer = get_channel_layer()
        
        if note_id:
            note = Note.objects.get(id=note_id)
            note.body = note_content
            note.title = note_title
            note.save()
            
            # Broadcast save notification to all collaborators
            async_to_sync(channel_layer.group_send)(
                f'note_{note_id}',
                {
                    'type': 'note_saved',
                    'message': 'Note saved successfully'
                }
            )
            
            return JsonResponse({
                'status': 'success',
                'id': note.id,
                'title': note.title
            }, status=200)
        else:
            note = Note.objects.create(body=note_content, title=note_title)
            return JsonResponse({
                'status': 'success',
                'id': note.id,
                'title': note.title
            }, status=201)
    
    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)
    except Note.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Note not found'}, status=404)

@csrf_exempt
@require_http_methods(["DELETE"])
def delete_note(request, id):
    try:
        note = get_object_or_404(Note, id=id)
        
        # Notify all collaborators before deletion
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f'note_{id}',
            {
                'type': 'note_deleted',
                'message': 'Note has been deleted'
            }
        )
        
        note.delete()
        return JsonResponse({'status': 'success'}, status=200)
    except Note.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Note not found'}, status=404)