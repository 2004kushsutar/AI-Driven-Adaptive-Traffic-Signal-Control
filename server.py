#!/usr/bin/env python3
"""
================================================
ENHANCED TRAFFIC SIGNAL SYSTEM - BACKEND
AI-Powered Vehicle Detection & Predictive Traffic Control
================================================
"""

import cv2
import time
import os
import sys
import numpy as np
from ultralytics import YOLO
from flask import Flask, request 
from flask_socketio import SocketIO
from datetime import datetime

# ============================================
# CONFIGURATION
# ============================================
class Config:
    SNAPSHOT_BEFORE_END = 3000  # Take snapshot 3s before green ends (milliseconds)
    CONFIDENCE = 0.2            # YOLO confidence threshold
    APP_PORT = 5000             # Flask server port
    RESIZE_W = 320              # Frame width for processing
    RESIZE_H = 240              # Frame height for processing
    MODEL_PATH = 'yolov8n.pt'   # YOLO model
    VIDEO_DIRS = ['north', 'south', 'east', 'west']
    VEHICLE_CLASSES = [1, 2, 3, 5, 7]  # car, motorcycle, bus, truck, train
    DISPLAY_GRID = True         # Show OpenCV window
    DEBUG = True                # Enable debug logging
    EMERGENCY_GREEN_TIME = 30000  # 30s fixed time for emergency override

config = Config()

# ============================================
# FLASK & SOCKETIO SETUP
# ============================================
app = Flask(__name__)
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='eventlet',
    logger=config.DEBUG,
    engineio_logger=config.DEBUG
)

# ============================================
# GLOBAL STATE
# ============================================
class TrafficSystem:
    def __init__(self):
        self.model = None
        self.videos = {}
        self.last_counts = {'north': 0, 'south': 0, 'east': 0, 'west': 0}
        self.total_detections = 0
        self.start_time = time.time()
        self.frame_count = 0
        self.snapshot_requests = []  # Queue for snapshot requests from frontend
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] [{level}] {message}")

system = TrafficSystem()

# ============================================
# INITIALIZATION
# ============================================
def initialize_system():
    """Initialize YOLO model and video captures"""
    try:
        system.log("Initializing Traffic Control System...")
        
        # Check if model exists
        if not os.path.exists(config.MODEL_PATH):
            system.log(f"Downloading YOLO model: {config.MODEL_PATH}", "INFO")
        
        # Load YOLO model
        system.log("Loading AI Model...", "INFO")
        system.model = YOLO(config.MODEL_PATH)
        system.log("✅ YOLO Model Loaded Successfully", "SUCCESS")
        
        # Initialize video captures
        for direction in config.VIDEO_DIRS:
            video_path = f'{direction}.mp4'
            
            if not os.path.exists(video_path):
                system.log(f"❌ ERROR: {video_path} not found!", "ERROR")
                system.log(f"Please ensure {video_path} exists in the current directory", "ERROR")
                return False
            
            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                system.log(f"❌ ERROR: Cannot open {video_path}", "ERROR")
                return False
            
            system.videos[direction] = cap
            system.log(f"✅ Loaded {video_path}", "SUCCESS")
        
        system.log("System Initialization Complete", "SUCCESS")
        return True
        
    except Exception as e:
        system.log(f"Initialization Error: {str(e)}", "ERROR")
        return False

# ============================================
# VIDEO PROCESSING
# ============================================
def get_frame(cap):
    """Read and resize frame, handle video looping"""
    success, frame = cap.read()
    
    if not success:
        # Loop video
        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        success, frame = cap.read()
        
    if not success:
        system.log("Failed to read frame", "WARNING")
        return None
    
    return cv2.resize(frame, (config.RESIZE_W, config.RESIZE_H))

def detect_vehicles(frame):
    """Run YOLO detection on frame"""
    try:
        results = system.model(
            frame,
            verbose=False,
            conf=config.CONFIDENCE,
            classes=config.VEHICLE_CLASSES
        )
        
        detections = results[0].boxes
        count = len(detections)
        
        return count, detections
        
    except Exception as e:
        system.log(f"Detection error: {str(e)}", "ERROR")
        return 0, None

def draw_detections(frame, detections, count, direction):
    """Draw bounding boxes and labels on frame"""
    if detections is not None and len(detections) > 0:
        for box in detections:
            # Get coordinates
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            conf = float(box.conf[0])
            cls = int(box.cls[0])
            
            # Draw box
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            
            # Draw label
            label = f"{conf:.2f}"
            cv2.putText(frame, label, (x1, y1 - 5),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 255, 0), 1)
    
    # Draw direction label and count
    cv2.rectangle(frame, (0, 0), (config.RESIZE_W, 45), (0, 0, 0), -1)
    cv2.putText(frame, f"{direction.upper()}", (10, 25),
               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 255), 2)
    cv2.putText(frame, f"Vehicles: {count}", (10, 42),
               cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    return frame

def take_snapshot_for_direction(direction):
    """Take a snapshot and count vehicles for a specific direction"""
    try:
        system.log(f"📸 Taking snapshot for {direction.upper()}...", "INFO")
        
        # Get current frame for the direction
        cap = system.videos.get(direction)
        if not cap:
            system.log(f"Video capture not found for {direction}", "ERROR")
            return 0
        
        frame = get_frame(cap)
        if frame is None:
            system.log(f"Failed to get frame for {direction}", "ERROR")
            return 0
        
        # Run AI detection
        count, detections = detect_vehicles(frame)
        
        # Update the count for this direction
        system.last_counts[direction] = count
        
        system.log(f"  {direction.upper()}: {count} vehicles detected", "SUCCESS")
        
        return count
        
    except Exception as e:
        system.log(f"Snapshot error for {direction}: {str(e)}", "ERROR")
        return 0
    
# ============================================
# MAIN TRAFFIC MONITORING LOOP
# ============================================
def traffic_monitor():
    """Main loop for video processing and display"""
    system.log("🎬 Starting Traffic Monitor...", "INFO")
    system.log(f"Predictive snapshot mode: {config.SNAPSHOT_BEFORE_END/1000}s before green ends", "INFO")
    
    fps_start_time = time.time()
    frame_counter = 0
    
    while True:
        try:
            current_time = time.time()
            
            # 1. Process snapshot requests from frontend
            while len(system.snapshot_requests) > 0:
                direction = system.snapshot_requests.pop(0)
                count = take_snapshot_for_direction(direction)
                
                # Send the updated count to frontend
                socketio.emit('snapshot_result', {
                    'direction': direction,
                    'count': count
                })
                system.log(f"📤 Sent snapshot result for {direction}: {count} vehicles", "INFO")
            
            # 2. Read frames for display only (no AI processing here)
            frames = {}
            for direction in config.VIDEO_DIRS:
                frame = get_frame(system.videos[direction])
                if frame is None:
                    continue
                
                # Draw with last known counts
                count = system.last_counts[direction]
                frames[direction] = draw_detections(frame, None, count, direction)
            
            # 3. Create grid display
            if config.DISPLAY_GRID and len(frames) == 4:
                top_row = np.hstack((frames['north'], frames['east']))
                bottom_row = np.hstack((frames['west'], frames['south']))
                grid_view = np.vstack((top_row, bottom_row))
                
                # Add system info overlay
                info_height = 60
                info_panel = np.zeros((info_height, grid_view.shape[1], 3), dtype=np.uint8)
                
                # System stats
                uptime = int(current_time - system.start_time)
                total_vehicles = sum(system.last_counts.values())
                
                cv2.putText(info_panel, f"Uptime: {uptime}s", (10, 20),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
                cv2.putText(info_panel, f"Total: {total_vehicles} vehicles", (10, 45),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
                cv2.putText(info_panel, f"FPS: {frame_counter/(current_time-fps_start_time):.1f}",
                           (grid_view.shape[1] - 100, 20),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1)
                cv2.putText(info_panel, "Mode: PREDICTIVE", (grid_view.shape[1] - 200, 45),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 165, 0), 1)
                
                final_view = np.vstack((info_panel, grid_view))
                cv2.imshow("🚦 Traffic Control System - Predictive Mode", final_view)
            
            # 4. Frame rate control
            frame_counter += 1
            if cv2.waitKey(30) & 0xFF == ord('q'):
                system.log("Shutdown signal received", "WARNING")
                break
            
            # Reset FPS counter every second
            if current_time - fps_start_time > 1.0:
                frame_counter = 0
                fps_start_time = current_time
            
            # Yield control to eventlet
            socketio.sleep(0.01)
            
        except KeyboardInterrupt:
            system.log("Keyboard interrupt received", "WARNING")
            break
        except Exception as e:
            system.log(f"Error in main loop: {str(e)}", "ERROR")
            socketio.sleep(1)
    
    # Cleanup
    cleanup()

# ============================================
# CLEANUP
# ============================================
def cleanup():
    """Release resources"""
    system.log("Cleaning up resources...", "INFO")
    
    for direction, cap in system.videos.items():
        cap.release()
    
    cv2.destroyAllWindows()
    system.log("Cleanup complete", "SUCCESS")

# ============================================
# FLASK ROUTES
# ============================================
@app.route('/')
def index():
    return {
        'status': 'online',
        'system': 'Traffic Control Backend - Predictive Mode',
        'version': '3.0',
        'uptime': int(time.time() - system.start_time)
    }

@app.route('/status')
def status():
    return {
        'counts': system.last_counts,
        'total': sum(system.last_counts.values()),
        'uptime': int(time.time() - system.start_time),
        'mode': 'predictive'
    }

# ============================================
# SOCKETIO EVENTS
# ============================================
@socketio.on('connect')
def handle_connect():
    system.log(f"Client connected: {request.sid if 'request' in dir() else 'unknown'}", "INFO")
    # Send initial state
    socketio.emit('traffic_update', system.last_counts)

@socketio.on('disconnect')
def handle_disconnect():
    system.log("Client disconnected", "INFO")

@socketio.on('request_snapshot')
def handle_snapshot_request(data):
    """Handle snapshot request from frontend"""
    direction = data.get('direction', '').lower()
    
    if direction not in config.VIDEO_DIRS:
        system.log(f"Invalid direction in snapshot request: {direction}", "ERROR")
        return
    
    system.log(f"Received snapshot request for {direction.upper()}", "INFO")
    
    # Add to queue to be processed in main loop
    system.snapshot_requests.append(direction)

# ============================================
# MAIN ENTRY POINT
# ============================================
if __name__ == '__main__':
    print("=" * 60)
    print("🚦 ENHANCED TRAFFIC SIGNAL CONTROL SYSTEM")
    print("=" * 60)
    
    # Initialize system
    if not initialize_system():
        system.log("Failed to initialize system. Exiting.", "ERROR")
        sys.exit(1)
    
    # Start background task
    socketio.start_background_task(traffic_monitor)
    
    print("-" * 60)
    print(f"🌐 Server running on http://localhost:{config.APP_PORT}")
    print(f"📊 Open the web interface to view live traffic data")
    print(f"🎥 Video feeds: {', '.join(config.VIDEO_DIRS)}")
    print(f"⏱️  Snapshot Mode: PREDICTIVE (3s before green ends)")
    print("-" * 60)
    print("Press 'Q' in the video window to shutdown")
    print("=" * 60)
    
    # Run Flask app
    try:
        socketio.run(
            app,
            host='0.0.0.0',
            port=config.APP_PORT,
            debug=False,
            use_reloader=False
        )
    except KeyboardInterrupt:
        system.log("Server shutdown requested", "WARNING")
    finally:
        cleanup()