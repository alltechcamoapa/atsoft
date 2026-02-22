import re

path = r'c:\Users\ALLTECH\Documents\PROYECTOS APPS\ALLTECH SUPPORT\js\modules\reportes.js'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Fix App.showNotification to NotificationService.showToast
text = text.replace("App.showNotification(", "if (typeof window.NotificationService !== 'undefined' && window.NotificationService.showToast) { window.NotificationService.showToast(")
# Add closed braces to those lines if needed
text = text.replace(", 'info');", ", 'info'); }")

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Notification fallback fixed')
