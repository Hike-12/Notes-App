from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/note/(?P<note_id>\w+)/?$', consumers.NoteConsumer.as_asgi()),
    re_path(r'ws/yjs/(?P<note_id>\w+)/?$', consumers.YjsWebsocketConsumer.as_asgi()),
]