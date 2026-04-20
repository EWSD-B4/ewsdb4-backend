$path = 'postman\EWSD University Magazine API.current.postman_collection.json'
$outPath = 'postman\EWSD University Magazine API.showcase.postman_collection.json'
$collection = Get-Content -Raw -Path $path | ConvertFrom-Json -Depth 100

function Ensure-Variable($key, $value) {
  $existing = $collection.variable | Where-Object { $_.key -eq $key }
  if ($existing) {
    $existing.value = $value
  } else {
    $collection.variable += [pscustomobject]@{ key = $key; value = $value }
  }
}

function New-Event($listen, [string[]]$exec) {
  return [pscustomobject]@{
    listen = $listen
    script = [pscustomobject]@{
      type = 'text/javascript'
      exec = $exec
    }
  }
}

function New-Header($key, $value) {
  return [pscustomobject]@{ key = $key; value = $value }
}

function New-RawBody($raw) {
  return [pscustomobject]@{
    mode = 'raw'
    raw = $raw
    options = [pscustomobject]@{
      raw = [pscustomobject]@{ language = 'json' }
    }
  }
}

function New-FormDataBody($items) {
  return [pscustomobject]@{
    mode = 'formdata'
    formdata = $items
  }
}

function New-RequestItem($name, $method, $url, $description, $body, $headers, $tests, $prerequest) {
  $events = @()
  if ($prerequest -and $prerequest.Count -gt 0) { $events += New-Event 'prerequest' $prerequest }
  if ($tests -and $tests.Count -gt 0) { $events += New-Event 'test' $tests }

  $request = [ordered]@{
    method = $method
    description = $description
    url = $url
  }
  if ($headers -and $headers.Count -gt 0) { $request.header = $headers }
  if ($body) { $request.body = $body }

  $item = [ordered]@{
    name = $name
    request = [pscustomobject]$request
  }
  if ($events.Count -gt 0) { $item.event = $events }
  return [pscustomobject]$item
}

$initScript = @(
  "if (!pm.collectionVariables.get('runId')) {",
  "  const runId = String(Date.now());",
  "  const suffix = runId.slice(-6);",
  "  pm.collectionVariables.set('runId', runId);",
  "  pm.collectionVariables.set('showcaseFacultyCode', `SC${suffix}`);",
  "  pm.collectionVariables.set('showcaseFacultyName', `Showcase Faculty ${suffix}`);",
  "  pm.collectionVariables.set('showcaseFacultyDescription', `Showcase faculty ${suffix}`);",
  "  pm.collectionVariables.set('showcaseYearName', `SC-${suffix}`);",
  "  pm.collectionVariables.set('showcaseTermsVersion', `showcase-${suffix}`);",
  "  pm.collectionVariables.set('showcaseUserPassword', 'Showcase@123');",
  "  pm.collectionVariables.set('showcaseCoordinatorEmail', `showcase.coordinator.${suffix}@example.com`);",
  "  pm.collectionVariables.set('showcaseManagerEmail', `showcase.manager.${suffix}@example.com`);",
  "  pm.collectionVariables.set('showcaseStudentEmail', `showcase.student.${suffix}@example.com`);",
  "  pm.collectionVariables.set('showcaseGuestEmail', `showcase.guest.${suffix}@example.com`);",
  "  pm.collectionVariables.set('showcaseContributionATitle', `Showcase Contribution A ${suffix}`);",
  "  pm.collectionVariables.set('showcaseContributionBTitle', `Showcase Contribution B ${suffix}`);",
  "  pm.collectionVariables.set('showcaseContributionCTitle', `Showcase Contribution C ${suffix}`);",
  "  pm.collectionVariables.unset('showcaseFacultyId');",
  "  pm.collectionVariables.unset('showcaseAcademicYearId');",
  "  pm.collectionVariables.unset('showcaseTermsId');",
  "  pm.collectionVariables.unset('showcaseSelectedContributionId');",
  "  pm.collectionVariables.unset('showcaseRejectedContributionId');",
  "  pm.collectionVariables.unset('showcasePendingContributionId');",
  "  pm.collectionVariables.unset('showcaseCommentId');",
  "  pm.collectionVariables.unset('showcaseTempCommentId');",
  "  pm.collectionVariables.unset('showcaseFileId');",
  "}"
)

$commonJsonHeader = @(New-Header 'Content-Type' 'application/json')

$successItems = @(
  (New-RequestItem 'Initialize Showcase Variables' 'GET' '{{baseUrl}}/health' 'Run this first. It initializes a unique run id and derived emails/titles so the showcase can be replayed without collisions.' $null @() @(
    "pm.test('Health check ok', function () { pm.response.to.have.status(200); });",
    "const body = pm.response.json();",
    "pm.test('Health payload exists', function () { pm.expect(body.success).to.eql(true); });"
  ) $initScript),

  (New-RequestItem 'Login - Admin (Showcase)' 'POST' '{{baseUrl}}/auth/login' 'Uses the seeded admin account to bootstrap the rest of the demo data.' (New-RawBody @'
{
  "email": "{{demoAdminEmail}}",
  "password": "{{demoAdminPassword}}"
}
'@) $commonJsonHeader @(
    "pm.test('Admin login ok', function () { pm.response.to.have.status(200); });",
    "const body = pm.response.json();",
    "const token = body?.data?.token;",
    "if (token) { pm.collectionVariables.set('adminToken', token); pm.collectionVariables.set('authToken', token); }"
  ) @()),

  (New-RequestItem 'Get Roles (Capture Role IDs)' 'GET' '{{baseUrl}}/admin/roles' 'Captures role ids by roleCode so user creation requests do not depend on hard-coded ids.' $null @(New-Header 'Authorization' 'Bearer {{adminToken}}') @(
    "pm.test('Roles loaded', function () { pm.response.to.have.status(200); });",
    "const roles = pm.response.json()?.data || [];",
    "for (const role of roles) {",
    "  const code = String(role.roleCode || role.role_code || '').toUpperCase();",
    "  if (code === 'ADMIN') pm.collectionVariables.set('adminRoleId', String(role.id));",
    "  if (code === 'MANAGER') pm.collectionVariables.set('managerRoleId', String(role.id));",
    "  if (code === 'COORDINATOR') pm.collectionVariables.set('coordinatorRoleId', String(role.id));",
    "  if (code === 'STUDENT') pm.collectionVariables.set('studentRoleId', String(role.id));",
    "  if (code === 'GUEST') pm.collectionVariables.set('guestRoleId', String(role.id));",
    "}"
  ) @()),

  (New-RequestItem 'Create Faculty - Showcase' 'POST' '{{baseUrl}}/admin/faculties' 'Creates a dedicated faculty for the showcase users and guest access flow.' (New-RawBody @'
{
  "code": "{{showcaseFacultyCode}}",
  "name": "{{showcaseFacultyName}}",
  "description": "{{showcaseFacultyDescription}}"
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Faculty created', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.id;",
    "if (id) { pm.collectionVariables.set('showcaseFacultyId', String(id)); pm.collectionVariables.set('facultyId', String(id)); }"
  ) @()),

  (New-RequestItem 'Create Academic Year - Showcase' 'POST' '{{baseUrl}}/academic-years' 'Creates a future academic year so submission, review and manager failure-download scenarios are deterministic.' (New-RawBody @'
{
  "yearName": "{{showcaseYearName}}",
  "startDate": "2099-01-01",
  "endDate": "2099-12-31",
  "closureDate": "2099-11-30T23:59:59.000Z",
  "closureFinalDate": "2099-12-31T23:59:59.000Z"
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Academic year created', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.id;",
    "if (id) { pm.collectionVariables.set('showcaseAcademicYearId', String(id)); pm.collectionVariables.set('academicYearId', String(id)); }"
  ) @()),

  (New-RequestItem 'Create Terms - Showcase' 'POST' '{{baseUrl}}/terms' 'Creates a dedicated terms record for contribution agreement related flows.' (New-RawBody @'
{
  "version": "{{showcaseTermsVersion}}",
  "content": "Showcase terms and conditions for tomorrow demo.",
  "effectiveDate": "2099-01-01T00:00:00.000Z"
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Terms created', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.id;",
    "if (id) { pm.collectionVariables.set('showcaseTermsId', String(id)); pm.collectionVariables.set('termsId', String(id)); }"
  ) @()),

  (New-RequestItem 'Create Coordinator User - Showcase' 'POST' '{{baseUrl}}/users/create' 'Admin creates a coordinator in the showcase faculty.' (New-RawBody @'
{
  "email": "{{showcaseCoordinatorEmail}}",
  "name": "Showcase Coordinator",
  "password": "{{showcaseUserPassword}}",
  "role_id": {{coordinatorRoleId}},
  "faculty_id": {{showcaseFacultyId}}
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Coordinator created', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.id; if (id) pm.collectionVariables.set('showcaseCoordinatorUserId', String(id));"
  ) @()),

  (New-RequestItem 'Create Manager User - Showcase' 'POST' '{{baseUrl}}/users/create' 'Admin creates a manager for manager-only reporting and ZIP routes.' (New-RawBody @'
{
  "email": "{{showcaseManagerEmail}}",
  "name": "Showcase Manager",
  "password": "{{showcaseUserPassword}}",
  "role_id": {{managerRoleId}},
  "faculty_id": {{showcaseFacultyId}}
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Manager created', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.id; if (id) pm.collectionVariables.set('showcaseManagerUserId', String(id));"
  ) @()),

  (New-RequestItem 'Create Student User - Showcase' 'POST' '{{baseUrl}}/users/create' 'Admin creates a student who will submit showcase contributions.' (New-RawBody @'
{
  "email": "{{showcaseStudentEmail}}",
  "name": "Showcase Student",
  "password": "{{showcaseUserPassword}}",
  "role_id": {{studentRoleId}},
  "faculty_id": {{showcaseFacultyId}}
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Student created', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.id; if (id) pm.collectionVariables.set('showcaseStudentUserId', String(id));"
  ) @()),

  (New-RequestItem 'Create Guest User - Showcase' 'POST' '{{baseUrl}}/users/create' 'Admin creates a guest account to exercise guest-management backend features.' (New-RawBody @'
{
  "email": "{{showcaseGuestEmail}}",
  "name": "Showcase Guest",
  "password": "{{showcaseUserPassword}}",
  "role_id": {{guestRoleId}},
  "faculty_id": {{showcaseFacultyId}}
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Guest created', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.id; if (id) pm.collectionVariables.set('showcaseGuestUserId', String(id));"
  ) @()),

  (New-RequestItem 'Login - Coordinator (Showcase)' 'POST' '{{baseUrl}}/auth/login' 'Captures a coordinator token used in comment/review flows.' (New-RawBody @'
{
  "email": "{{showcaseCoordinatorEmail}}",
  "password": "{{showcaseUserPassword}}"
}
'@) $commonJsonHeader @(
    "pm.test('Coordinator login ok', function () { pm.response.to.have.status(200); });",
    "const token = pm.response.json()?.data?.token; if (token) pm.collectionVariables.set('coordinatorToken', token);"
  ) @()),

  (New-RequestItem 'Login - Manager (Showcase)' 'POST' '{{baseUrl}}/auth/login' 'Captures a manager token used in reporting and selected-download flows.' (New-RawBody @'
{
  "email": "{{showcaseManagerEmail}}",
  "password": "{{showcaseUserPassword}}"
}
'@) $commonJsonHeader @(
    "pm.test('Manager login ok', function () { pm.response.to.have.status(200); });",
    "const token = pm.response.json()?.data?.token; if (token) pm.collectionVariables.set('managerToken', token);"
  ) @()),

  (New-RequestItem 'Login - Student (Showcase)' 'POST' '{{baseUrl}}/auth/login' 'Captures a student token used in upload, replace and delete flows.' (New-RawBody @'
{
  "email": "{{showcaseStudentEmail}}",
  "password": "{{showcaseUserPassword}}"
}
'@) $commonJsonHeader @(
    "pm.test('Student login ok', function () { pm.response.to.have.status(200); });",
    "const token = pm.response.json()?.data?.token; if (token) pm.collectionVariables.set('studentToken', token);"
  ) @()),

  (New-RequestItem 'Submit Contribution A - Showcase' 'POST' '{{baseUrl}}/student/contributions/submit' 'Student uploads the contribution that will be selected by the coordinator. Uses local tmp/test-contribution.docx.' (New-FormDataBody @(
    [pscustomobject]@{ key='title'; value='{{showcaseContributionATitle}}'; type='text' },
    [pscustomobject]@{ key='academicYearId'; value='{{showcaseAcademicYearId}}'; type='text' },
    [pscustomobject]@{ key='docx'; type='file'; src='D:\ewsdb4-backend\tmp\test-contribution.docx' }
  )) @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('Contribution A submitted', function () { pm.response.to.have.status(201); });",
    "const body = pm.response.json();",
    "const id = body?.data?.contribution?.id;",
    "if (id) { pm.collectionVariables.set('showcaseSelectedContributionId', String(id)); pm.collectionVariables.set('contributionId', String(id)); }"
  ) @()),

  (New-RequestItem 'Submit Contribution B - Showcase' 'POST' '{{baseUrl}}/student/contributions/submit' 'Student uploads the contribution that will be rejected by the coordinator.' (New-FormDataBody @(
    [pscustomobject]@{ key='title'; value='{{showcaseContributionBTitle}}'; type='text' },
    [pscustomobject]@{ key='academicYearId'; value='{{showcaseAcademicYearId}}'; type='text' },
    [pscustomobject]@{ key='docx'; type='file'; src='D:\ewsdb4-backend\tmp\test-contribution.docx' }
  )) @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('Contribution B submitted', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.contribution?.id; if (id) pm.collectionVariables.set('showcaseRejectedContributionId', String(id));"
  ) @()),

  (New-RequestItem 'Get Student Contributions - Showcase' 'GET' '{{baseUrl}}/student/contributions' 'Verifies the student can see both newly submitted contributions.' $null @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('Student contribution list ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Coordinator List Contributions - Showcase' 'GET' '{{baseUrl}}/coordinator/contributions' 'Coordinator should see showcase contributions scoped to the showcase faculty.' $null @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}') @(
    "pm.test('Coordinator contribution list ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Create Comment for Contribution A' 'POST' '{{baseUrl}}/comments' 'Coordinator leaves a comment that will be reused by the select endpoint.' (New-RawBody @'
{
  "contributionId": {{showcaseSelectedContributionId}},
  "content": "Selected for showcase publication. Strong contribution and clear structure."
}
'@) @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Coordinator comment created', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.id; if (id) { pm.collectionVariables.set('showcaseCommentId', String(id)); pm.collectionVariables.set('commentId', String(id)); }"
  ) @()),

  (New-RequestItem 'Update Status A -> under_review' 'PUT' '{{baseUrl}}/coordinator/contributions/{{showcaseSelectedContributionId}}/status' 'Moves contribution A into under_review to respect the current strict backend workflow before final decision.' (New-RawBody @'
{
  "status": "under_review"
}
'@) @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Contribution A under review', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Select Contribution A' 'POST' '{{baseUrl}}/coordinator/contributions/{{showcaseSelectedContributionId}}/select' 'Current frontend-compatible flow: no request body, backend reuses the latest coordinator comment.' (New-RawBody '{}') @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Contribution A selected', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Create Comment for Contribution B' 'POST' '{{baseUrl}}/comments' 'Coordinator leaves rejection feedback that will be reused by the reject endpoint.' (New-RawBody @'
{
  "contributionId": {{showcaseRejectedContributionId}},
  "content": "Needs revision before publication. Please improve references and conclusion."
}
'@) @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Coordinator comment B created', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.id; if (id) pm.collectionVariables.set('showcaseTempCommentId', String(id));"
  ) @()),

  (New-RequestItem 'Update Status B -> under_review' 'PUT' '{{baseUrl}}/coordinator/contributions/{{showcaseRejectedContributionId}}/status' 'Moves contribution B into under_review before rejection.' (New-RawBody @'
{
  "status": "under_review"
}
'@) @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Contribution B under review', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Reject Contribution B' 'POST' '{{baseUrl}}/coordinator/contributions/{{showcaseRejectedContributionId}}/reject' 'Current frontend-compatible flow: no request body, backend reuses the latest coordinator comment.' (New-RawBody '{}') @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Contribution B rejected', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Get Files For Contribution A' 'GET' '{{baseUrl}}/documents/contributions/{{showcaseSelectedContributionId}}/files' 'Captures a file id so the file and document-content endpoints can be demonstrated.' $null @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('Contribution files loaded', function () { pm.response.to.have.status(200); });",
    "const file = pm.response.json()?.data?.files?.[0];",
    "if (file?.id) { pm.collectionVariables.set('showcaseFileId', String(file.id)); pm.collectionVariables.set('fileId', String(file.id)); }"
  ) @()),

  (New-RequestItem 'Get File By ID - Showcase' 'GET' '{{baseUrl}}/documents/files/{{showcaseFileId}}' 'Demonstrates document metadata retrieval for the uploaded DOCX.' $null @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('File metadata loaded', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Get Content By Contribution - Showcase' 'GET' '{{baseUrl}}/documents/content/contribution/{{showcaseSelectedContributionId}}' 'Shows extracted Tiptap/markdown content if document processing has completed.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Contribution content request finished', function () { pm.expect([200,404]).to.include(pm.response.code); });"
  ) @()),

  (New-RequestItem 'Manager List Contributions - Showcase' 'GET' '{{baseUrl}}/manager/contributions' 'Uses the compatibility route currently needed by the frontend dashboard.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Manager contributions list ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Manager List Selected Contributions' 'GET' '{{baseUrl}}/manager/contributions/selected' 'Manager sees the selected contribution after coordinator review.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Manager selected list ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Manager Get Selected Contribution' 'GET' '{{baseUrl}}/manager/contributions/selected/{{showcaseSelectedContributionId}}' 'Fetches the selected showcase contribution detail.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Manager selected detail ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Admin List Guests - Showcase' 'GET' '{{baseUrl}}/admin/guests?facultyId={{showcaseFacultyId}}' 'Shows guest-management output for the showcase faculty.' $null @(New-Header 'Authorization' 'Bearer {{adminToken}}') @(
    "pm.test('Guest list ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Guest List Faculties - Showcase' 'GET' '{{baseUrl}}/guest/faculties' 'Public guest flow: faculty listing for browsing selected contributions.' $null @() @(
    "pm.test('Guest faculties ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Guest List Selected Contributions By Faculty' 'GET' '{{baseUrl}}/guest/faculties/{{showcaseFacultyId}}/contributions/selected' 'Public guest flow: selected contributions for the showcase faculty.' $null @() @(
    "pm.test('Guest selected list ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Guest Get Selected Contribution' 'GET' '{{baseUrl}}/guest/contributions/{{showcaseSelectedContributionId}}' 'Public guest flow: read the selected contribution detail.' $null @() @(
    "pm.test('Guest contribution detail ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Get Comments For Contribution A' 'GET' '{{baseUrl}}/comments?contributionId={{showcaseSelectedContributionId}}' 'Shows the coordinator feedback thread now that contribution A has been selected.' $null @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('Comments list ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Get Notifications - Coordinator' 'GET' '{{baseUrl}}/notifications' 'Shows in-app notifications accumulated during the showcase run.' $null @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}') @(
    "pm.test('Notifications loaded', function () { pm.response.to.have.status(200); });",
    "const first = pm.response.json()?.data?.[0]; if (first?.id) pm.collectionVariables.set('notificationId', String(first.id));"
  ) @()),

  (New-RequestItem 'Manager Statistics - Showcase' 'GET' '{{baseUrl}}/manager/contributions/reports/statistics?academicYearId={{showcaseAcademicYearId}}' 'Manager-only aggregate statistics for the created academic year.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Manager statistics ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Manager Faculty Year Report - Showcase' 'GET' '{{baseUrl}}/manager/contributions/reports/faculty-year?academicYearId={{showcaseAcademicYearId}}&filterBy=all' 'Manager chart/report endpoint with the new filterBy support.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Manager faculty-year report ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Manager Exception Report - Showcase' 'GET' '{{baseUrl}}/manager/contributions/reports/exceptions' 'Manager exception report for missing comments / overdue review tracking.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Manager exceptions ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Analytics Dashboard - Showcase' 'GET' '{{baseUrl}}/analytics/dashboard?period=all&academicYearId={{showcaseAcademicYearId}}' 'Role-aware analytics dashboard endpoint for admin/manager/coordinator.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Analytics dashboard ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Reports Faculty Statistics - Showcase' 'GET' '{{baseUrl}}/reports/faculty/{{showcaseFacultyId}}/statistics?academicYearId={{showcaseAcademicYearId}}' 'Manager report endpoint for faculty statistics.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Faculty statistics ok', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'History - Admin Audit Trail' 'GET' '{{baseUrl}}/history/audit-trail' 'Admin-only history endpoint to demonstrate audit visibility.' $null @(New-Header 'Authorization' 'Bearer {{adminToken}}') @(
    "pm.test('Audit trail request finished', function () { pm.expect([200,404]).to.include(pm.response.code); });"
  ) @()),

  (New-RequestItem 'Plagiarism - Get Flagged Contributions' 'GET' '{{baseUrl}}/plagiarism/flagged' 'Showcases the flagged plagiarism list when data exists. A 200 with an empty list is acceptable for demo.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('Flagged plagiarism request finished', function () { pm.response.to.have.status(200); });"
  ) @())
)

$failureItems = @(
  (New-RequestItem 'Fail - Invalid Login' 'POST' '{{baseUrl}}/auth/login' 'Sanity check for invalid credentials.' (New-RawBody @'
{
  "email": "{{showcaseStudentEmail}}",
  "password": "WrongPassword123"
}
'@) $commonJsonHeader @(
    "pm.test('Invalid login rejected', function () { pm.expect([400,401]).to.include(pm.response.code); });"
  ) @()),

  (New-RequestItem 'Fail - Duplicate Faculty (Showcase)' 'POST' '{{baseUrl}}/admin/faculties' 'Reuses the showcase faculty code and name to demonstrate conflict handling.' (New-RawBody @'
{
  "code": "{{showcaseFacultyCode}}",
  "name": "{{showcaseFacultyName}}",
  "description": "duplicate"
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Duplicate faculty rejected', function () { pm.response.to.have.status(409); });"
  ) @()),

  (New-RequestItem 'Fail - Duplicate Showcase User' 'POST' '{{baseUrl}}/users/create' 'Reuses the showcase student email to demonstrate duplicate-user handling.' (New-RawBody @'
{
  "email": "{{showcaseStudentEmail}}",
  "name": "Duplicate Student",
  "password": "{{showcaseUserPassword}}",
  "role_id": {{studentRoleId}},
  "faculty_id": {{showcaseFacultyId}}
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Duplicate user rejected', function () { pm.response.to.have.status(409); });"
  ) @()),

  (New-RequestItem 'Fail - Student Hits Admin Roles' 'GET' '{{baseUrl}}/admin/roles' 'Student should not be able to access admin-only metadata.' $null @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('Student blocked from admin route', function () { pm.response.to.have.status(403); });"
  ) @()),

  (New-RequestItem 'Fail - Academic Year Final Before Closure' 'POST' '{{baseUrl}}/academic-years' 'Validation failure for final closure date earlier than closure date.' (New-RawBody @'
{
  "yearName": "BAD-{{runId}}",
  "startDate": "2099-01-01",
  "endDate": "2099-12-31",
  "closureDate": "2099-12-20T00:00:00.000Z",
  "closureFinalDate": "2099-12-10T00:00:00.000Z"
}
'@) @(New-Header 'Authorization' 'Bearer {{adminToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Academic year validation failed', function () { pm.expect([400,422]).to.include(pm.response.code); });"
  ) @()),

  (New-RequestItem 'Fail - Submit Contribution Missing DOCX' 'POST' '{{baseUrl}}/student/contributions/submit' 'Student multipart request without the required DOCX file.' (New-FormDataBody @(
    [pscustomobject]@{ key='title'; value='Missing DOCX {{runId}}'; type='text' },
    [pscustomobject]@{ key='academicYearId'; value='{{showcaseAcademicYearId}}'; type='text' }
  )) @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('Missing DOCX rejected', function () { pm.expect([400,422]).to.include(pm.response.code); });"
  ) @()),

  (New-RequestItem 'Fail - Submit Contribution Short Title' 'POST' '{{baseUrl}}/student/contributions/submit' 'Student title shorter than backend minimum validation.' (New-FormDataBody @(
    [pscustomobject]@{ key='title'; value='AB'; type='text' },
    [pscustomobject]@{ key='academicYearId'; value='{{showcaseAcademicYearId}}'; type='text' },
    [pscustomobject]@{ key='docx'; type='file'; src='D:\ewsdb4-backend\tmp\test-contribution.docx' }
  )) @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('Short title rejected', function () { pm.expect([400,422]).to.include(pm.response.code); });"
  ) @()),

  (New-RequestItem 'Create Contribution C - Failure Seed' 'POST' '{{baseUrl}}/student/contributions/submit' 'Creates a third contribution used to demonstrate select/reject failure without a prior coordinator comment.' (New-FormDataBody @(
    [pscustomobject]@{ key='title'; value='{{showcaseContributionCTitle}}'; type='text' },
    [pscustomobject]@{ key='academicYearId'; value='{{showcaseAcademicYearId}}'; type='text' },
    [pscustomobject]@{ key='docx'; type='file'; src='D:\ewsdb4-backend\tmp\test-contribution.docx' }
  )) @(New-Header 'Authorization' 'Bearer {{studentToken}}') @(
    "pm.test('Contribution C submitted', function () { pm.response.to.have.status(201); });",
    "const id = pm.response.json()?.data?.contribution?.id; if (id) pm.collectionVariables.set('showcasePendingContributionId', String(id));"
  ) @()),

  (New-RequestItem 'Update Status C -> under_review' 'PUT' '{{baseUrl}}/coordinator/contributions/{{showcasePendingContributionId}}/status' 'Prepares contribution C for no-comment decision failure tests.' (New-RawBody @'
{
  "status": "under_review"
}
'@) @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Contribution C under review', function () { pm.response.to.have.status(200); });"
  ) @()),

  (New-RequestItem 'Fail - Select Without Comment' 'POST' '{{baseUrl}}/coordinator/contributions/{{showcasePendingContributionId}}/select' 'No comment body and no existing coordinator comment should be rejected.' (New-RawBody '{}') @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Select without comment rejected', function () { pm.expect([400,422]).to.include(pm.response.code); });"
  ) @()),

  (New-RequestItem 'Fail - Reject Without Comment' 'POST' '{{baseUrl}}/coordinator/contributions/{{showcasePendingContributionId}}/reject' 'Same failure path for reject without any coordinator comment source.' (New-RawBody '{}') @(New-Header 'Authorization' 'Bearer {{coordinatorToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Reject without comment rejected', function () { pm.expect([400,422]).to.include(pm.response.code); });"
  ) @()),

  (New-RequestItem 'Fail - Create Comment Forbidden Role' 'POST' '{{baseUrl}}/comments' 'Manager should not be allowed to comment because only coordinators and contribution owners may do so.' (New-RawBody @'
{
  "contributionId": {{showcaseSelectedContributionId}},
  "content": "Manager should not be allowed to comment."
}
'@) @(New-Header 'Authorization' 'Bearer {{managerToken}}', New-Header 'Content-Type' 'application/json') @(
    "pm.test('Forbidden comment rejected', function () { pm.response.to.have.status(403); });"
  ) @()),

  (New-RequestItem 'Fail - Manager Download Before Final Closure' 'GET' '{{baseUrl}}/manager/contributions/selected/download?academicYearId={{showcaseAcademicYearId}}' 'Current backend should block ZIP download before the final closure date.' $null @(New-Header 'Authorization' 'Bearer {{managerToken}}') @(
    "pm.test('ZIP download blocked before final closure', function () { pm.response.to.have.status(403); });"
  ) @())
)

$showcaseSuccessFolder = [pscustomobject]@{
  name = '00 Showcase - Success Run'
  description = 'Run top-to-bottom for tomorrow demo. This folder creates unique data, exercises each role, and captures ids/tokens for the rest of the collection.'
  item = $successItems
}

$showcaseFailureFolder = [pscustomobject]@{
  name = '00 Showcase - Failure Run'
  description = 'Run after the success folder. These requests reuse showcase ids to demonstrate the main backend validation and authorization failures.'
  item = $failureItems
}

$collection.info.name = 'EWSD University Magazine API.showcase'
$collection.info.description = 'Showcase-ready Postman collection for the EWSD backend. Run the two 00 Showcase folders first for tomorrow demo, then explore the module folders for full endpoint coverage.'
$collection.event = @((New-Event 'prerequest' $initScript))

@(
  'demoAdminEmail', 'demoAdminPassword', 'runId', 'showcaseFacultyCode', 'showcaseFacultyName', 'showcaseFacultyDescription',
  'showcaseYearName', 'showcaseTermsVersion', 'showcaseUserPassword', 'showcaseCoordinatorEmail', 'showcaseManagerEmail',
  'showcaseStudentEmail', 'showcaseGuestEmail', 'showcaseFacultyId', 'showcaseAcademicYearId', 'showcaseTermsId',
  'showcaseCoordinatorUserId', 'showcaseManagerUserId', 'showcaseStudentUserId', 'showcaseGuestUserId', 'adminRoleId',
  'managerRoleId', 'coordinatorRoleId', 'studentRoleId', 'guestRoleId', 'showcaseContributionATitle', 'showcaseContributionBTitle',
  'showcaseContributionCTitle', 'showcaseSelectedContributionId', 'showcaseRejectedContributionId', 'showcasePendingContributionId',
  'showcaseCommentId', 'showcaseTempCommentId', 'showcaseFileId'
) | ForEach-Object { Ensure-Variable $_ '' }

$defaults = @{
  demoAdminEmail = 'admin@ewsd.edu'
  demoAdminPassword = 'Admin@123'
}
$defaults.GetEnumerator() | ForEach-Object { Ensure-Variable $_.Key $_.Value }

$remaining = @($collection.item | Where-Object { $_.name -notin @('00 Showcase - Success Run', '00 Showcase - Failure Run') })
$collection.item = @($showcaseSuccessFolder, $showcaseFailureFolder) + $remaining

$collection | ConvertTo-Json -Depth 100 | Set-Content -Path $outPath -Encoding UTF8
Write-Output \"Wrote $outPath\"
