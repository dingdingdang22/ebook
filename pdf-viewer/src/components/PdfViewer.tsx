import React from 'react';
import { BookX } from 'lucide-react';

interface PdfViewerProps {
  filePath: string | null;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({ filePath }) => {
  if (!filePath) {
    return (
      <div className="viewer-container">
        <div className="empty-state">
          <BookX className="empty-state-icon" />
          <p>Select a PDF from the sidebar to start reading</p>
        </div>
      </div>
    );
  }

  // Use the path directly since the PDFs will be hosted on the same domain
  // The filePath comes with a leading slash, e.g., /数学/人教版教材/...
  const encodedPath = filePath.split('/').map(segment => encodeURIComponent(segment)).join('/');

  return (
    <div className="viewer-container">
      <iframe
        src={encodedPath}
        className="pdf-iframe"
        title="PDF Viewer"
      />
    </div>
  );
};
