const PROJECT_URL = `${process.env.BASE_URL}/project`

const getProjects = async () => {
    const res = await fetch(`${PROJECT_URL}/`, {
        method: 'GET',
        credentials: 'include',
    })

    if (!res.ok) {
        throw new Error('failed to fetch projects')
    }

    return res.json()
}

const getProject = async (projectId: string) => {
    const res = await fetch(`${PROJECT_URL}/${projectId}`, {
        method: 'GET',
        credentials: 'include',
    })

    if (!res.ok) {
        throw new Error('failed to fetch project')
    }

    return res.json()
}

const createProject = async (data: {
    name: string
    description: string
    prompt: string
}) => {
    const res = await fetch(`${PROJECT_URL}/`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })

    if (!res.ok) {
        throw new Error('failed to create project')
    }

    return res.json()
}

const updateProject = async (
    projectId: string,
    data: {
        rename?: string
        isStarred?: string
    }
) => {
    const res = await fetch(`${PROJECT_URL}/${projectId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })

    if (!res.ok) {
        throw new Error('failed to update project')
    }

    return res.json()
}

const deleteProject = async (projectId: string) => {
    const res = await fetch(`${PROJECT_URL}/${projectId}`, {
        method: "DELETE",
        credentials: "include"
    })

    if(!res.ok){
        throw new Error("failed to delete project")
    }

    return res.json()
}

export const projectAPI = {
    getProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject
}
