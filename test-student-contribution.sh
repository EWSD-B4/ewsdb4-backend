#!/bin/bash

# Test student contribution workflow
echo "=== Testing Student Contribution Workflow ==="

# 1. Login as student
echo -e "\n1. Logging in as student..."
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@ewsd.edu","password":"Student@123"}')

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.data.token')
echo "Token: ${TOKEN:0:50}..."

# 2. Create a simple DOCX file for testing
echo -e "\n2. Creating test DOCX file..."
cat > /tmp/test-contribution.txt << 'EOF'
# My Test Contribution

This is a test contribution document.

## Introduction
This document demonstrates the student contribution workflow.

## Content
- Point 1: Upload DOCX file
- Point 2: File is stored in S3
- Point 3: Metadata saved to database
- Point 4: Message sent to RabbitMQ
- Point 5: Worker processes the file
- Point 6: Converted to markdown and stored back in S3

## Conclusion
This is a complete end-to-end test.
EOF

# Note: For a real test, you'd need a proper DOCX file
# For now, we'll create a minimal one using a simple approach
echo "Note: Using text file as placeholder. In production, use a real DOCX file."

# 3. Submit contribution
echo -e "\n3. Submitting contribution..."
CONTRIBUTION_RESPONSE=$(curl -s -X POST http://localhost:3000/api/v1/student/contributions \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/tmp/test-contribution.txt" \
  -F "title=My First Contribution" \
  -F "academicYearId=1")

echo "Response:"
echo $CONTRIBUTION_RESPONSE | jq .

# 4. Check database
echo -e "\n4. Checking database..."
docker exec ewsdb4-mysql-local mysql -uewsdb4_user -pewsdb4_password ewsdb4_db -e "
SELECT c.id, c.title, c.status, cf.file_type, cf.file_path 
FROM contributions c 
LEFT JOIN contribution_files cf ON c.id = cf.contribution_id 
ORDER BY c.id DESC LIMIT 1;" 2>/dev/null

# 5. Check worker logs
echo -e "\n5. Checking worker logs (last 10 lines)..."
docker logs ewsdb4-worker-local --tail 10

echo -e "\n=== Test Complete ==="
