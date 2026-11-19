-- Allow PDF uploads alongside the existing image types in the private bucket.
update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/pdf')
where id = 'ticket-attachments'
  and allowed_mime_types is not null
  and not ('application/pdf' = any (allowed_mime_types));
