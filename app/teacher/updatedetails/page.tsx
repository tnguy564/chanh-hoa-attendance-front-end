"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Student {
  _id: string;
  studentId: string;
  studentName: string;
  buddhaName: string;
  role: string;
  email: string;
  phoneNumber: string;
  status?: string;
  created_at?: number;
  updated_at?: number;
}

interface SearchFilters {
  studentId: string;
  studentName: string;
  buddhaName: string;
  role: string;
}

export default function TeacherUpdateStudentDetails() {
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [originalStudent, setOriginalStudent] = useState<Student | null>(null);
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState("");
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [userType, setUserType] = useState<"student" | "teacher">("teacher");

  // Role-aware dashboard path
  const dashboardPath = useMemo(
    () => (userType === "teacher" ? "/teacher/dashboard" : "/dashboard"),
    [userType]
  );

  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    studentId: "",
    studentName: "",
    buddhaName: "",
    role: ""
  });
  useEffect(() => {
    const checkAuthStatus = () => {
      try {
        const loggedIn = localStorage.getItem("isLoggedIn") === "true";
        const utype = (localStorage.getItem("userType") as "student" | "teacher") || "student";
        
        if (!loggedIn || utype !== "teacher") {
          setIsAuthed(false);
          router.replace("/signin");
        } else {
          setIsAuthed(true);
          setUserType(utype);
        }
      } catch (error) {
        setIsAuthed(false);
        router.replace("/signin");
      }
    };

    const timeoutId = setTimeout(checkAuthStatus, 100);
    return () => clearTimeout(timeoutId);
  }, [router]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setSearchFilters(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const clearFilters = () => {
    setSearchFilters({
      studentId: "",
      studentName: "",
      buddhaName: "",
      role: ""
    });
    setSearchResults([]);
    setStatus("");
  };

  const searchStudents = async () => {

    setSearching(true);
    setStatus("");
    setSearchResults([]);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      
      Object.entries(searchFilters).forEach(([key, value]) => {
        if (value.trim()) {
          params.append(key, value.trim());
        }
      });

      const res = await fetch(`http://127.0.0.1:5000/api/teacher/students/search?${params}`, {
        headers: {
          "Content-Type": "application/json",
          "X-User-Type": "teacher",
          "X-User-Email": localStorage.getItem("userEmail") || ""
        }
      });

      const data = await res.json();

      if (data.success) {
        setSearchResults(data.students);
        if (data.students.length === 0) {
          setStatus("No members found matching your search criteria");
        } else {
          setStatus(`Found ${data.students.length} student(s)`);
        }
      } else {
        setStatus(`❌ ${data.error || "Search failed"}`);
        setSearchResults([]);
      }
    } catch (error) {
      setStatus("❌ Error connecting to server");
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const selectStudent = async (selectedStudent: Student) => {
    setLoading(true);
    setStatus("");

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/teacher/student/${selectedStudent._id}`, {
        headers: {
          "Content-Type": "application/json",
          "X-User-Type": "teacher",
          "X-User-Email": localStorage.getItem("userEmail") || ""
        }
      });

      const data = await res.json();

      if (data.success && data.student) {
        setStudent(data.student);
        setOriginalStudent({ ...data.student });
        setStatus(`Selected student: ${data.student.studentName}`);
      } else {
        setStatus(`❌ ${data.error || "Could not load student details"}`);
      }
    } catch (error) {
      setStatus("❌ Error loading student details");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (student) {
      setStudent(prev => ({
        ...prev!,
        [e.target.name]: e.target.value
      }));
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) return;

    setUpdating(true);
    setStatus("Updating student details...");

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/teacher/student/${student._id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Type": "teacher",
          "X-User-Email": localStorage.getItem("userEmail") || ""
        },
        body: JSON.stringify({
          studentName: student.studentName,
          studentId: student.studentId,
          buddhaName: student.buddhaName,
          role: student.role,
          email: student.email,
          phoneNumber: student.phoneNumber
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setStatus("✅ Student details updated successfully!");
        setOriginalStudent({ ...student });
        // Update search results if student is in the list
        setSearchResults(prev => prev.map(s => s._id === student._id ? student : s));
      } else {
        setStatus(`❌ ${data.error}`);
      }
    } catch (err) {
      setStatus("❌ Error connecting to server");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!student) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete student ${student.studentName} (ID: ${student.studentId})?\n\nThis action cannot be undone and will remove all face recognition data.`
    );
    
    if (!confirmed) return;

    setUpdating(true);
    setStatus("Deleting student...");

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/teacher/student/${student._id}`, {
        method: "DELETE",
        headers: { 
          "Content-Type": "application/json",
          "X-User-Type": "teacher",
          "X-User-Email": localStorage.getItem("userEmail") || ""
        }
      });
      
      const data = await res.json();
      
      if (data.success) {
        setStatus(`✅ Student ${student.studentName} deleted successfully!`);
        setStudent(null);
        setOriginalStudent(null);
        // Remove from search results
        setSearchResults(prev => prev.filter(s => s._id !== student._id));
      } else {
        setStatus(`❌ ${data.error}`);
      }
    } catch (err) {
      setStatus("❌ Error connecting to server");
    } finally {
      setUpdating(false);
    }
  };

  const resetForm = () => {
    if (originalStudent) {
      setStudent({ ...originalStudent });
      setStatus("");
    }
  };

  const hasChanges = () => {
    if (!student || !originalStudent) return false;
    return JSON.stringify(student) !== JSON.stringify(originalStudent);
  };

  if (isAuthed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authorization...</p>
        </div>
      </div>
    );
  }

  if (isAuthed === false) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Role-Aware Back Button */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#274e13]">Update Member Details</h1>
            <p className="text-gray-600">Search and update any student&apos;s information</p>
          </div>
          <button
            onClick={() => router.push(dashboardPath)}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Advanced Search Panel */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Search Filters</h3>
            
            <div className="space-y-4">
              {/* Student ID Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Member ID
                </label>
                <input
                  type="text"
                  name="studentId"
                  placeholder="e.g., 123"
                  value={searchFilters.studentId}
                  onChange={handleFilterChange}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Student Name Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Member Name
                </label>
                <input
                  type="text"
                  name="studentName"
                  placeholder="e.g., John Doe"
                  value={searchFilters.studentName}
                  onChange={handleFilterChange}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                  Buddha Name
                </label>
                <input
                  type="text"
                  name="buddhaName"
                  placeholder="e.g., 123"
                  value={searchFilters.buddhaName}
                  onChange={handleFilterChange}
                  className="w-full border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Search Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={searchStudents}
                  disabled={searching}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {searching ? "Searching..." : "Search Members"}
                </button>
                <button
                  onClick={clearFilters}
                  className="w-full py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>

          {/* Search Results */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Search Results</h3>
            
            {searchResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p className="text-lg mb-2">No members found</p>
                <p className="text-sm">Use the search filters to find members</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map(studentItem => (
                  <div
                    key={studentItem._id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                      student?._id === studentItem._id
                        ? "bg-blue-100 border-blue-500"
                        : "bg-gray-50 hover:bg-gray-100 border-gray-200"
                    }`}
                    onClick={() => selectStudent(studentItem)}
                  >
                    <div className="font-medium text-gray-800">{studentItem.studentName}</div>
                    <div className="text-sm text-gray-600">
                      ID: {studentItem.studentId}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Details Form */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Member information</h3>
            
            {!student ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg mb-2">No member selected</p>
                <p className="text-sm">Search for and select a member to view and edit their details</p>
              </div>
            ) : (
              <form onSubmit={handleUpdate} className="space-y-6">
                {/* Student Info Header */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-blue-800">Selected Student</h4>
                      <p className="text-blue-600">{originalStudent?.studentName}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-blue-600">ID: {originalStudent?.studentId}</p>
                      <p className="text-xs text-blue-500">
                        {originalStudent?.updated_at ? 
                          `Updated: ${new Date(originalStudent.updated_at * 1000).toLocaleDateString()}` :
                          'Never updated'
                        }
                      </p>
                    </div>
                  </div>
                  {hasChanges() && (
                    <div className="mt-2 text-xs text-orange-600">
                      ⚠️ You have unsaved changes
                    </div>
                  )}
                </div>

                {/* Personal Information */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Personal Information</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <input
                      name="studentName"
                      type="text"
                      placeholder="Full Name"
                      value={student.studentName}
                      onChange={handleInputChange}
                      className="border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      name="buddhaName"
                      type="text"
                      placeholder="Buddha Name"
                      value={student.buddhaName}
                      onChange={handleInputChange}
                      className="border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      name="studentId"
                      type="text"
                      placeholder="Member ID"
                      value={student.studentId}
                      onChange={handleInputChange}
                      className="border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      name="email"
                      type="email"
                      placeholder="Email"
                      value={student.email}
                      onChange={handleInputChange}
                      className="border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <input
                      name="phoneNumber"
                      type="tel"
                      placeholder="Phone Number"
                      value={student.phoneNumber}
                      onChange={handleInputChange}
                      className="border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    {/* Dropdown for Role/Membership */}
                  <select
                    name="role"
                    value={student.role || ""} 
                    onChange={handleInputChange}
                    className="border border-gray-300 px-3 py-2 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  >
                    <option value="" disabled>Select Status</option>
                    <option value="member">Member</option>
                    <option value="staff">Huynh Trưởng</option>
                  </select>
                  </div>

                </div>


                {/* Action Buttons */}
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    disabled={updating || !hasChanges()}
                    className="flex-1 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {updating ? "Updating..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={!hasChanges()}
                    className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={updating}
                    className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Status Display */}
        {status && (
          <div className={`mt-6 p-4 rounded-lg text-center max-w-2xl mx-auto ${
            status.includes("✅") 
              ? "bg-green-100 text-green-800 border border-green-200" 
              : "bg-red-100 text-red-800 border border-red-200"
          }`}>
            {status}
          </div>
        )}
      </div>
    </main>
  );
}
