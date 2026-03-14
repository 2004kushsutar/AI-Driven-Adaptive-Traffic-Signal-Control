# 🚦 AUTOMATED TRAFFIC SIGNAL SIMULATION

An AI-powered traffic management system using YOLOv8 for real-time vehicle detection and intelligent signal timing optimization.

![System Status](https://img.shields.io/badge/status-operational-brightgreen)
![Python](https://img.shields.io/badge/python-3.8+-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🌟 Key Features

### 🤖 AI-Powered Detection
- **YOLOv8** real-time vehicle detection
- Detects: cars, motorcycles, buses, trucks, trains
- 20% confidence threshold for accuracy
- Processes frames every 5 seconds

### ⚡ Intelligent Signal Timing
```
Green Time = 5s (startup) + (vehicle_count × 3s)
Range: 10-60 seconds
```

### 🎨 Modern Web Interface
- Real-time traffic visualization
- Color-coded traffic volume bars
- Live countdown timers
- System statistics dashboard
- Emergency override controls
- Comprehensive logging system

### 🔒 Safety Features
- 3-second yellow light transition
- 2-second all-red clearance
- Round-robin fair scheduling
- Emergency vehicle priority

## 📋 Requirements

### System Requirements
- Python 3.8 or higher
- Webcam or video files (MP4 format)
- 4GB RAM minimum
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Python Dependencies
```bash
opencv-python>=4.8.0
ultralytics>=8.0.0
flask>=2.3.0
flask-socketio>=5.3.0
eventlet>=0.33.0
numpy>=1.24.0
```

## 🚀 Installation

### 1. Clone Repository
```bash
git clone https://github.com/2004kushsutar/VahanGati.git
cd VahanGati
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```


### 3. Prepare Video Files
Place your traffic camera footage in the root directory:
- `north.mp4` - North direction camera
- `south.mp4` - South direction camera  
- `east.mp4` - East direction camera
- `west.mp4` - West direction camera

**Note:** The system will automatically download the YOLOv8n model (~6MB) on first run.

### 4. Project Structure
```
traffic-signal-system/
|--images/
├── server.py           # Python backend (Flask + YOLO)
├── index.html          # Web interface
├── script.js           # Frontend logic
├── style.css           # Styling
├── requirements.txt    # Python dependencies
├── simulation.py          # Simulation file
├── north.mp4          # North camera feed
├── south.mp4          # South camera feed
├── east.mp4           # East camera feed
└── west.mp4           # West camera feed
```
---

## 🎬 Demo

### Simulation Interface
```
┌────────────────────────────────────────────────┐
│  🚗→  NORTH: 8 vehicles  [GREEN: 29s]         │
│  🚗↓  EAST:  12 vehicles [RED: 45s]           │
│  🚗←  SOUTH: 3 vehicles  [RED: 52s]           │
│  🚗↑  WEST:  5 vehicles  [RED: 59s]           │
│                                                │
│  Total Vehicles Passed: 147                   │
│  System Uptime: 245s                          │
└────────────────────────────────────────────────┘
```

### Web Dashboard
```
┌──────────────────────────────────────────────────────┐
│  🟢 AUTOMATED TRAFFIC SIGNAL SIMULATION     [Live]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│         N                                            │
│      ┌──┴──┐                                         │
│   W  │  🚦 │  E      Traffic Volume:                │
│      └──┬──┘          North: ████████░░ 82%          │
│         S             South: ███░░░░░░░ 31%          │
│                       East:  ██████████ 100%         │
│  Emergency Override   West:  █████░░░░░ 52%          │
│  [N] [S] [E] [W]                                     │
└──────────────────────────────────────────────────────┘
```

---

## 🎮 Usage

### Starting the System

#### Step 1: Start Backend Server
```bash
python server.py
```

#### Step 1: Start Simulation
```bash
python simulation.py
```

You should see:
```
🚦 ENHANCED TRAFFIC SIGNAL CONTROL SYSTEM
============================================================
✅ YOLO Model Loaded Successfully
✅ Loaded north.mp4
✅ Loaded south.mp4
✅ Loaded east.mp4
✅ Loaded west.mp4
------------------------------------------------------------
🌐 Server running on http://localhost:5000
Press 'Q' in the video window to shutdown
```

#### Step 2: Open Web Interface
Open `index.html` in your browser, or use a local server:

**Option A: Direct File**
```bash
# Simply double-click index.html
# Or right-click → Open with → Browser
```

**Option B: Local Server (Recommended)**
```bash
# Python 3
python -m http.server 8000

# Then visit: http://localhost:8000
```

### System Controls

#### Emergency Override
Click any direction button (North/South/East/West) to immediately switch that signal to green for emergency vehicles.

#### Reset System
Clears all statistics and restarts the traffic cycle from the beginning.

#### Clear Logs
Removes all entries from the system log display.

## 🎯 How It Works

### Data Flow
```
Video Feeds → Frame Extraction → YOLO Detection → Vehicle Count
                                                        ↓
                                                  Socket.IO
                                                        ↓
                                              JavaScript Frontend
                                                        ↓
                                           Calculate Smart Timing
                                                        ↓
                                         Update Traffic Signals
```

### Signal Timing Algorithm

1. **Base Time Calculation**
   ```python
   green_time = 5000ms + (vehicle_count × 3000ms)
   ```

2. **Safety Bounds**
   - Minimum: 10 seconds (ensures safe crossing)
   - Maximum: 60 seconds (prevents excessive waiting)

3. **Transition Phases**
   - Yellow: 3 seconds (prepare to stop)
   - All-Red: 2 seconds (clearance interval)

### Example Scenarios

| Vehicles | Calculation | Green Time |
|----------|-------------|------------|
| 0 | 5 + (0 × 3) = 5s | **10s** (min) |
| 5 | 5 + (5 × 3) = 20s | **20s** |
| 10 | 5 + (10 × 3) = 35s | **35s** |
| 15 | 5 + (15 × 3) = 50s | **50s** |
| 25+ | 5 + (25 × 3) = 80s | **60s** (max) |

```

## 📊 Dashboard Metrics

### Traffic Volume Panel
- Live vehicle counts per direction
- Color-coded progress bars:
  - 🟢 Green: 0-33% (Low traffic)
  - 🟡 Yellow: 33-66% (Medium traffic)
  - 🔴 Red: 66-100% (High traffic)
- Estimated wait times

### Statistics Panel
- **Total Vehicles**: Sum across all directions
- **Current Cycle**: Number of completed cycles
- **System Uptime**: Time since initialization
- **Avg Wait Time**: Average green light duration

### System Logs
- Real-time event tracking
- Color-coded by severity:
  - ✅ Green: Success/Normal operations
  - ⚠️ Yellow: Warnings
  - ❌ Red: Errors/Emergency
  - ℹ️ Blue: Information

## 🐛 Troubleshooting

### Issue: "Cannot connect to server"
**Solution:**
1. Verify backend is running: `python server.py`
2. Check port 5000 is available: `netstat -an | grep 5000`
3. Check firewall settings
4. Try accessing: http://localhost:5000/status

### Issue: "Video file not found"
**Solution:**
```bash
# Check if all video files exist
ls -l *.mp4

# They should show:
# north.mp4
# south.mp4
# east.mp4
# west.mp4
```

### Issue: "Model download fails"
**Solution:**
```bash
# Manually download YOLOv8n
wget https://github.com/ultralytics/assets/releases/download/v0.0.0/yolov8n.pt

# Or use Python
python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
```

### Issue: "Detection not working"
**Solution:**
1. Lower confidence threshold in `server.py`:
   ```python
   CONFIDENCE = 0.1  # Try lower value
   ```
2. Check vehicle classes are visible in video
3. Ensure adequate lighting in footage

### Issue: "Slow performance"
**Solution:**
1. Reduce frame size in `server.py`:
   ```python
   RESIZE_W = 240
   RESIZE_H = 180
   ```
2. Increase AI interval:
   ```python
   SNAPSHOT_INTERVAL = 10  # Run less frequently
   ```
3. Close other applications
4. Use GPU if available (CUDA-enabled)

## 🚀 Advanced Features (Future Enhancements)

### Planned Features
- [ ] Pedestrian detection & crosswalk signals
- [ ] Multi-intersection synchronization
- [ ] Historical traffic analytics dashboard
- [ ] Weather-based timing adjustments
- [ ] Mobile app for traffic managers
- [ ] Machine learning for rush hour prediction
- [ ] Integration with city traffic systems
- [ ] Real-time incident detection

### Contributing
We welcome contributions! Areas for improvement:
- Performance optimization
- New detection algorithms
- UI/UX enhancements
- Documentation
- Testing frameworks


## 🙏 Acknowledgments

- **Ultralytics** - YOLOv8 model
- **OpenCV** - Computer vision library
- **Flask** - Web framework
- **Socket.IO** - Real-time communication
- **Tailwind CSS** - UI styling

---

**Made with ❤️ for smarter cities**

🚦 Happy Traffic Managing! 🚦