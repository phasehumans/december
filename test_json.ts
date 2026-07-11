const badJson = `{
  "error": {
    "message": "This has a literal newline
    inside the string."
  }
}`

try {
    JSON.parse(badJson)
    console.log('Parsed successfully')
} catch (e: any) {
    console.error('Parse failed:', e.message)
}
