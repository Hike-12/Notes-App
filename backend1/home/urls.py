"""
URL configuration for scribe project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path,include
from home import views

urlpatterns = [
    # Note operations
    path('api/sidebar/', views.sidebar, name='sidebar'),
    path('api/save-note/', views.save_note, name='save_note'),
    path('api/get-note/<int:id>/', views.get_note, name='get_note'),
    path('api/delete-note/<int:id>/', views.delete_note, name='delete_note'),
    
    # Sharing operations
    path('api/share-note/<int:note_id>/', views.share_note, name='share_note'),
    path('api/revoke-share/<int:note_id>/<int:share_id>/', views.revoke_share, name='revoke_share'),
    
    # Authentication
    path('api/auth/register/', views.register_user, name='register'),
    path('api/auth/login/', views.login_user, name='login'),
    path('api/auth/logout/', views.logout_user, name='logout'),
    path('api/auth/user/', views.get_current_user, name='current_user'),
    path('api/auth/search-users/', views.search_users, name='search_users'),
]