import moviepy.editor as mp

try:
    print("Loading video...")
    video = mp.VideoFileClip(r"c:\Users\goodm\Desktop\simmul\temporary\Screen_Recording_20260714_013251_Elevator 3D.mp4")
    print("Writing audio...")
    video.audio.write_audiofile(r"c:\Users\goodm\Desktop\simmul\sound\extracted_move.wav")
    print("Success")
except Exception as e:
    print(f"Error: {e}")
