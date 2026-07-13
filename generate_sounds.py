import os
import subprocess
import wave
import math
import struct

def generate_tts(text, filename):
    print(f"Generating TTS for: {text}")
    # edge-tts generates mp3
    subprocess.run([r"C:\Users\goodm\AppData\Local\Packages\PythonSoftwareFoundation.Python.3.12_qbz5n2kfra8p0\LocalCache\local-packages\Python312\Scripts\edge-tts.exe", "--voice", "en-US-JennyNeural", "--text", text, "--write-media", filename])

def generate_chime(filename):
    print("Generating chime...")
    # Generate ding-dong (800Hz then 600Hz)
    sample_rate = 44100
    duration1 = 0.5
    duration2 = 0.8
    freq1 = 800.0
    freq2 = 600.0
    
    num_samples1 = int(sample_rate * duration1)
    num_samples2 = int(sample_rate * duration2)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(num_samples1):
            # fade out
            volume = 32767.0 * (1.0 - i/num_samples1)**0.5 * 0.5
            value = int(volume * math.sin(2.0 * math.pi * freq1 * i / sample_rate))
            data = struct.pack('<h', value)
            wav_file.writeframesraw(data)
            
        for i in range(num_samples2):
            # fade out
            volume = 32767.0 * (1.0 - i/num_samples2)**1.5 * 0.5
            value = int(volume * math.sin(2.0 * math.pi * freq2 * i / sample_rate))
            data = struct.pack('<h', value)
            wav_file.writeframesraw(data)
            
def generate_hum(filename):
    print("Generating motor hum...")
    sample_rate = 44100
    duration = 2.0
    num_samples = int(sample_rate * duration)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(num_samples):
            # Complex wave for motor sound
            v1 = math.sin(2.0 * math.pi * 50.0 * i / sample_rate)
            v2 = math.sin(2.0 * math.pi * 150.0 * i / sample_rate) * 0.5
            v3 = math.sin(2.0 * math.pi * 300.0 * i / sample_rate) * 0.2
            
            # Add some slight amplitude modulation
            env = 1.0 + 0.1 * math.sin(2.0 * math.pi * 5.0 * i / sample_rate)
            
            volume = 32767.0 * 0.2 * env
            value = int(volume * (v1 + v2 + v3))
            
            # clip protection
            value = max(-32768, min(32767, value))
            data = struct.pack('<h', value)
            wav_file.writeframesraw(data)

def generate_door(filename, closing=False):
    print(f"Generating door {'close' if closing else 'open'}...")
    sample_rate = 44100
    duration = 1.5
    num_samples = int(sample_rate * duration)
    
    with wave.open(filename, 'w') as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        
        for i in range(num_samples):
            # Sliding frequency for door movement
            if closing:
                freq = 200.0 - 50.0 * (i / num_samples)
            else:
                freq = 150.0 + 50.0 * (i / num_samples)
                
            v = math.sin(2.0 * math.pi * freq * i / sample_rate)
            
            # Fade in/out
            if i < 4410:
                env = i / 4410
            elif i > num_samples - 4410:
                env = (num_samples - i) / 4410
            else:
                env = 1.0
                
            volume = 32767.0 * 0.1 * env
            value = int(volume * v)
            data = struct.pack('<h', value)
            wav_file.writeframesraw(data)

os.makedirs('sound', exist_ok=True)

# Generate voice announcements
generate_tts("First floor.", "sound/floor_1.mp3")
generate_tts("Second floor.", "sound/floor_2.mp3")
generate_tts("Third floor.", "sound/floor_3.mp3")
generate_tts("Fourth floor.", "sound/floor_4.mp3")
generate_tts("Going up.", "sound/depart_up.mp3")
generate_tts("Going down.", "sound/depart_down.mp3")
generate_tts("Doors are closing.", "sound/door_closing_voice.mp3")

# Generate effects
generate_chime("sound/chime.wav")
generate_hum("sound/move.wav")
generate_door("sound/door_open.wav", False)
generate_door("sound/door_close.wav", True)

print("Done generating sounds.")
