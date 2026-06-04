import { useState, useRef } from 'react'
import type { UserProfile, InBodyData } from '../lib/types'
import { extractInBody } from '../lib/claude'

interface Props {
  onSaved: (profile: UserProfile) => void
  onSkip: () => void
}

export default function ProfileSetup({ onSaved, onSkip }: Props) {
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [age, setAge] = useState('')
  const [gender, setGender] = useState<'male' | 'female'>('male')
  const [inbody, setInbody] = useState<InBodyData | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [inbodyError, setInbodyError] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const validate = () => {
    const e: Record<string, string> = {}
    const w = parseFloat(weight)
    const h = parseFloat(height)
    const a = parseInt(age)
    if (!weight || isNaN(w) || w <= 0) e.weight = 'عدد باید مثبت باشه'
    if (!height || isNaN(h) || h <= 0) e.height = 'عدد باید مثبت باشه'
    if (!age || isNaN(a) || a <= 0) e.age = 'عدد باید مثبت باشه'
    return e
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setInbodyError(null)
    setInbody(null)

    // Show preview
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string
      setImagePreview(dataUrl)

      // Extract base64 (strip data:...;base64, prefix)
      const base64 = dataUrl.split(',')[1]
      const mimeType = file.type || 'image/jpeg'

      setAnalyzing(true)
      try {
        const result = await extractInBody(base64, mimeType)
        setInbody(result)
      } catch {
        setInbodyError('نشد استخراج کرد، بعداً دوباره امتحان کن')
      } finally {
        setAnalyzing(false)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length > 0) return

    const profile: UserProfile = {
      weight_kg: parseFloat(weight),
      height_cm: parseFloat(height),
      age: parseInt(age),
      gender,
      ...(inbody ? { inbody } : {}),
    }
    onSaved(profile)
    setToast('پروفایل ذخیره شد ✓')
    setTimeout(() => setToast(null), 2000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-sm mx-auto" dir="rtl">
      {/* Header */}
      <header className="bg-white px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between">
        <h1 className="text-base font-bold text-gray-900">پروفایل من</h1>
        <button
          onClick={onSkip}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          رد کن
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">

        {/* Basic info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">اطلاعات پایه</h2>

          {/* Weight */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">وزن (kg)</label>
            <input
              type="number"
              min="1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="مثلاً ۷۲"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 ${errors.weight ? 'border-red-300' : 'border-gray-200'}`}
            />
            {errors.weight && <p className="text-red-400 text-xs mt-1">{errors.weight}</p>}
          </div>

          {/* Height */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">قد (cm)</label>
            <input
              type="number"
              min="1"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="مثلاً ۱۷۵"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 ${errors.height ? 'border-red-300' : 'border-gray-200'}`}
            />
            {errors.height && <p className="text-red-400 text-xs mt-1">{errors.height}</p>}
          </div>

          {/* Age */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">سن</label>
            <input
              type="number"
              min="1"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="مثلاً ۲۸"
              className={`w-full rounded-xl border px-4 py-2.5 text-sm text-gray-800 bg-gray-50 focus:outline-none focus:border-green-400 ${errors.age ? 'border-red-300' : 'border-gray-200'}`}
            />
            {errors.age && <p className="text-red-400 text-xs mt-1">{errors.age}</p>}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">جنسیت</label>
            <div className="flex gap-2">
              <button
                onClick={() => setGender('male')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${gender === 'male' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                مرد
              </button>
              <button
                onClick={() => setGender('female')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${gender === 'female' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                زن
              </button>
            </div>
          </div>
        </div>

        {/* InBody upload card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">آپلود تست اینبادی (اختیاری)</h2>
            <p className="text-xs text-gray-400 mt-0.5">برای هدف‌گذاری دقیق‌تر</p>
          </div>

          {/* Upload box */}
          {!imagePreview ? (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:border-green-300 hover:text-green-500 transition-colors"
            >
              <span className="text-3xl">📷</span>
              <span className="text-xs">عکس تست اینبادی رو اینجا بارگذاری کن</span>
            </button>
          ) : (
            <div className="relative">
              <img
                src={imagePreview}
                alt="InBody preview"
                className="w-full rounded-xl object-cover max-h-48"
              />
              <button
                onClick={() => {
                  setImagePreview(null)
                  setInbody(null)
                  setInbodyError(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="absolute top-2 left-2 bg-gray-900/60 text-white text-xs px-2 py-1 rounded-lg"
              >
                حذف
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />

          {/* Analyzing spinner */}
          {analyzing && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin inline-block" />
              در حال آنالیز...
            </div>
          )}

          {/* InBody result */}
          {inbody && !analyzing && (
            <div className="bg-green-50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-semibold text-green-700 mb-2">نتایج استخراج شده:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="font-bold text-green-600">{inbody.body_fat_percent}%</div>
                  <div className="text-gray-400">درصد چربی</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="font-bold text-blue-600">{inbody.muscle_mass_kg}kg</div>
                  <div className="text-gray-400">توده عضلانی</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="font-bold text-orange-500">{inbody.bmr}</div>
                  <div className="text-gray-400">BMR کال</div>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <div className="font-bold text-purple-600">{inbody.visceral_fat_level}</div>
                  <div className="text-gray-400">چربی احشایی</div>
                </div>
              </div>
            </div>
          )}

          {inbodyError && (
            <p className="text-orange-500 text-xs">{inbodyError}</p>
          )}
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold rounded-2xl py-4 transition-colors active:scale-95 text-sm"
        >
          ذخیره و ادامه
        </button>

      </div>

      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  )
}
