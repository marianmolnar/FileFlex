// imports
import {
  BsFillImageFill,
  BsFileEarmarkTextFill,
  BsFillCameraVideoFill,
  BsFileEarmarkPdfFill,
  BsFileEarmarkWordFill,
} from 'react-icons/bs';
import { FaFileAudio } from 'react-icons/fa';
import { AiFillFile } from 'react-icons/ai';
import { PiSpeakerSimpleHighFill } from 'react-icons/pi';

export default function fileToIcon(file_type: any): any {
  if (file_type.includes('video')) return <BsFillCameraVideoFill />;
  if (file_type.includes('audio')) return <PiSpeakerSimpleHighFill />;
  if (file_type.includes('text')) return <BsFileEarmarkTextFill />;
  if (file_type.includes('pdf')) return <BsFileEarmarkPdfFill />;
  if (file_type.includes('word') || file_type.includes('document')) return <BsFileEarmarkWordFill />;
  if (file_type.includes('image')) return <BsFillImageFill />;
  return <AiFillFile />;
}
