// https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript

export function copyToClipboard(text) {
  // @ts-ignore
  if (window.clipboardData && window.clipboardData.setData) {
    // @ts-ignore
    return window.clipboardData.setData('Text', text)
  } else if (
    document.queryCommandSupported &&
    document.queryCommandSupported('copy')
  ) {
    var textarea = document.createElement('textarea')
    textarea.textContent = text
    textarea.style.position = 'fixed'
    document.body.appendChild(textarea)
    textarea.select()
    try {
      return document.execCommand('copy')
    } catch (ex) {
      console.warn('Copy to clipboard failed.', ex)
      return false
    } finally {
      document.body.removeChild(textarea)
    }
  }
}